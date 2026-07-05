use std::collections::HashMap;
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::stream::{self, StreamExt};
use mc_api_types::{
    ApiError, ApiErrorCode, ChatRequest, ChatSessionDetailResponse, ChatSessionListItem,
    ChatSessionListResponse, ChatSessionTurn, ChatStreamEvent,
};
use mc_chat::{AgentChatRequest, ChatMessage, MessageRole};
use mc_db::db::repos::chat_messages;
use mc_db::db::repos::chat_sessions;
use mc_db::model::chat_quota_exempt;
use mc_db::model::ChatTurnRow;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::api::AppState;
use crate::auth::AuthUser;
use crate::chat_config::{agent_config, chat_enabled_for};
use crate::chat_quota::{calendar_week_start_utc, WEEKLY_MESSAGE_LIMIT};

fn rate_limit_per_minute() -> u32 {
    std::env::var("CHAT_RATE_LIMIT_PER_MINUTE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/chat", post(post_chat))
        .route("/chat/sessions", get(list_sessions))
        .route(
            "/chat/sessions/{session_id}",
            get(get_session).delete(delete_session),
        )
}

#[derive(Default)]
pub struct ChatRateLimiter {
    hits: Mutex<HashMap<String, Vec<Instant>>>,
}

impl ChatRateLimiter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut hits = self.hits.lock().unwrap();
        let entry = hits.entry(key.to_string()).or_default();
        entry.retain(|instant| now.duration_since(*instant) < Duration::from_secs(60));
        if entry.len() as u32 >= rate_limit_per_minute() {
            return false;
        }
        entry.push(now);
        true
    }
}

async fn post_chat(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ChatRequest>,
) -> Response {
    let settings = state.manager.settings();
    if !chat_enabled_for(&settings) {
        return chat_disabled_response();
    }

    let Some(agent) = state.chat.clone() else {
        return chat_disabled_response();
    };

    let config = match agent_config(&settings) {
        Ok(config) => config,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(ApiErrorCode::InternalError, &err)),
            )
                .into_response();
        }
    };

    let rate_key = user.id.to_string();
    if !state.chat_rate_limiter.check(&rate_key) {
        return sse_error(StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded");
    }

    let quota_exempt = chat_quota_exempt(user.role, user.flags);
    if !quota_exempt {
        let since = calendar_week_start_utc(chrono::Utc::now());
        let used = match chat_messages::count_since(&state.pool, user.id, since).await {
            Ok(count) => count as u32,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiError::new(
                        ApiErrorCode::InternalError,
                        "failed to check chat quota",
                    )),
                )
                    .into_response();
            }
        };
        if used >= WEEKLY_MESSAGE_LIMIT {
            return sse_error(
                StatusCode::TOO_MANY_REQUESTS,
                "weekly message limit reached",
            );
        }
    }

    if let Err(response) = validate_context_server(&state, &body).await {
        return response;
    }

    if chat_sessions::get_or_create_for_user(&state.pool, user.id, body.session_id)
        .await
        .is_err()
    {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiError::new(ApiErrorCode::Forbidden, "session not owned")),
        )
            .into_response();
    }

    let turns = match chat_sessions::list_turns(&state.pool, body.session_id).await {
        Ok(turns) => turns,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(
                    ApiErrorCode::InternalError,
                    "failed to load session",
                )),
            )
                .into_response();
        }
    };

    let request = AgentChatRequest {
        message: body.message,
        session_id: Some(body.session_id.to_string()),
        end_user_id: Some(user.id.to_string()),
        history: turns_to_messages(&turns),
        context_server: body.context_server,
    };

    let user_message = request.message.clone();
    let session_id = body.session_id;
    let pool = state.pool.clone();
    let user_id = user.id;
    let cancel = CancellationToken::new();
    let child_cancel = cancel.child_token();
    let spawn_cancel = cancel.clone();

    let agent_stream = agent.chat_stream(request, config, child_cancel);
    let (tx, rx) = mpsc::channel(64);
    tokio::spawn(async move {
        let mut agent_stream = agent_stream;
        let mut assistant_content = String::new();
        let mut tool_names = Vec::new();
        while let Some(item) = agent_stream.next().await {
            if spawn_cancel.is_cancelled() {
                break;
            }
            match item {
                Ok(ChatStreamEvent::Delta { content }) => {
                    assistant_content.push_str(&content);
                    if tx
                        .send(Ok(ChatStreamEvent::Delta { content }))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Ok(event @ ChatStreamEvent::ReasoningDelta { .. }) => {
                    if tx.send(Ok(event)).await.is_err() {
                        break;
                    }
                }
                Ok(ChatStreamEvent::ToolDone { name }) => {
                    tool_names.push(name.clone());
                    if tx
                        .send(Ok(ChatStreamEvent::ToolDone { name }))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Ok(event @ ChatStreamEvent::ToolStart { .. }) => {
                    if tx.send(Ok(event)).await.is_err() {
                        break;
                    }
                }
                Ok(mut done @ ChatStreamEvent::Done { .. }) => {
                    if let Err(err) = chat_sessions::append_turn_pair(
                        &pool,
                        user_id,
                        session_id,
                        &user_message,
                        &assistant_content,
                        &tool_names,
                    )
                    .await
                    {
                        tracing::error!(error = %err, "failed to persist chat turn");
                    } else if !quota_exempt {
                        if let Err(err) = chat_messages::record(&pool, user_id).await {
                            tracing::error!(error = %err, "failed to record chat quota");
                        }
                    }
                    if let ChatStreamEvent::Done { quota_used, .. } = &mut done {
                        if !quota_exempt {
                            let since = calendar_week_start_utc(chrono::Utc::now());
                            *quota_used = Some(
                                chat_messages::count_since(&pool, user_id, since)
                                    .await
                                    .unwrap_or(0) as u32,
                            );
                        }
                    }
                    let _ = tx.send(Ok(done)).await;
                    break;
                }
                Ok(event @ ChatStreamEvent::Error { .. }) => {
                    let _ = tx.send(Ok(event)).await;
                    break;
                }
                Err(err) => {
                    let _ = tx.send(Err(err)).await;
                    break;
                }
            }
        }
    });

    let event_stream = CancelOnDrop {
        inner: ReceiverStream::new(rx),
        cancel,
    }
    .map(|result| {
        let event = match result {
            Ok(payload) => Event::default().json_data(payload).unwrap(),
            Err(err) => Event::default()
                .json_data(ChatStreamEvent::Error {
                    message: err.to_string(),
                })
                .unwrap(),
        };
        Ok::<Event, Infallible>(event)
    });

    Sse::new(event_stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

struct CancelOnDrop<S> {
    inner: S,
    cancel: CancellationToken,
}

impl<S> Drop for CancelOnDrop<S> {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}

impl<S: futures::Stream + Unpin> futures::Stream for CancelOnDrop<S> {
    type Item = S::Item;

    fn poll_next(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        Pin::new(&mut self.inner).poll_next(cx)
    }
}

async fn list_sessions(State(state): State<AppState>, user: AuthUser) -> Response {
    match chat_sessions::list_sessions_for_user(&state.pool, user.id, 50, 0).await {
        Ok(sessions) => (
            StatusCode::OK,
            Json(ChatSessionListResponse {
                sessions: sessions
                    .into_iter()
                    .map(|s| ChatSessionListItem {
                        session_id: s.id,
                        updated_at: s.updated_at,
                        preview: s.preview,
                        turn_count: s.turn_count,
                    })
                    .collect(),
            }),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(
                ApiErrorCode::InternalError,
                "failed to list sessions",
            )),
        )
            .into_response(),
    }
}

async fn get_session(
    State(state): State<AppState>,
    user: AuthUser,
    Path(session_id): Path<Uuid>,
) -> Response {
    if !session_owned(&state, user.id, session_id).await {
        return session_not_found();
    }
    match chat_sessions::list_turns(&state.pool, session_id).await {
        Ok(turns) => (
            StatusCode::OK,
            Json(ChatSessionDetailResponse {
                session_id,
                turns: turns.into_iter().map(turn_to_dto).collect(),
            }),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(
                ApiErrorCode::InternalError,
                "failed to load session",
            )),
        )
            .into_response(),
    }
}

async fn delete_session(
    State(state): State<AppState>,
    user: AuthUser,
    Path(session_id): Path<Uuid>,
) -> Response {
    match chat_sessions::delete_session(&state.pool, user.id, session_id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(mc_db::DbError::NotFound(_)) => session_not_found(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiError::new(
                ApiErrorCode::InternalError,
                "failed to delete session",
            )),
        )
            .into_response(),
    }
}

async fn session_owned(state: &AppState, user_id: Uuid, session_id: Uuid) -> bool {
    chat_sessions::session_owned_by(&state.pool, user_id, session_id)
        .await
        .unwrap_or(false)
}

fn session_not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ApiError::new(ApiErrorCode::NotFound, "session not found")),
    )
        .into_response()
}

fn chat_disabled_response() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(ApiError::new(
            ApiErrorCode::InternalError,
            "chat is not configured",
        )),
    )
        .into_response()
}

async fn validate_context_server(state: &AppState, body: &ChatRequest) -> Result<(), Response> {
    let Some(ctx) = &body.context_server else {
        return Ok(());
    };
    let Ok(id) = Uuid::parse_str(&ctx.server_id) else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiError::new(ApiErrorCode::BadRequest, "invalid server_id")),
        )
            .into_response());
    };
    if state.manager.server_detail_response(id).await.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiError::new(ApiErrorCode::BadRequest, "unknown server_id")),
        )
            .into_response());
    }
    Ok(())
}

fn turns_to_messages(turns: &[ChatTurnRow]) -> Vec<ChatMessage> {
    turns
        .iter()
        .map(|turn| ChatMessage {
            role: match turn.role.as_str() {
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            },
            content: Some(turn.content.clone()),
            tool_calls: None,
            tool_call_id: None,
        })
        .collect()
}

fn turn_to_dto(turn: ChatTurnRow) -> ChatSessionTurn {
    ChatSessionTurn {
        role: turn.role,
        content: turn.content,
        tool_names: turn.tool_names,
        created_at: turn.created_at,
    }
}

fn sse_error(status: StatusCode, message: &str) -> Response {
    let event = Event::default().json_data(ChatStreamEvent::Error {
        message: message.into(),
    });
    (
        status,
        Sse::new(stream::once(async move {
            Ok::<Event, Infallible>(event.unwrap())
        })),
    )
        .into_response()
}
