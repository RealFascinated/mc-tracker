use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use futures::stream::{self, StreamExt};
use mc_api_types::{ChatRequest, ChatStreamEvent, ErrorResponse};
use mc_chat::{AgentChatRequest, ChatMessage};
use mc_db::db::repos::chat_messages;
use mc_db::model::UserRole;

use crate::api::AppState;
use crate::auth::AuthUser;
use crate::chat_quota::{calendar_week_start_utc, WEEKLY_MESSAGE_LIMIT};

const RATE_LIMIT_PER_MINUTE: u32 = 10;

pub fn router() -> Router<AppState> {
    Router::new().route("/chat", post(post_chat))
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
        if entry.len() as u32 >= RATE_LIMIT_PER_MINUTE {
            return false;
        }
        entry.push(now);
        true
    }
}

async fn post_chat(
    State(state): State<AppState>,
    user: AuthUser,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<SocketAddr>,
    Json(body): Json<ChatRequest>,
) -> Response {
    let Some(agent) = state.chat.clone() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse::new("chat is not configured")),
        )
            .into_response();
    };

    if !state.chat_rate_limiter.check(&addr.ip().to_string()) {
        return sse_error(StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded");
    }

    if user.role != UserRole::Admin {
        let since = calendar_week_start_utc(chrono::Utc::now());
        let used = match chat_messages::count_since(&state.pool, user.id, since).await {
            Ok(count) => count as u32,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse::new("failed to check chat quota")),
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
        if chat_messages::record(&state.pool, user.id).await.is_err() {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse::new("failed to record chat usage")),
            )
                .into_response();
        }
    }

    let raw_history = body.raw_history.and_then(|values| {
        values
            .into_iter()
            .map(|v| serde_json::from_value::<ChatMessage>(v).ok())
            .collect::<Option<Vec<_>>>()
    });

    let request = AgentChatRequest {
        message: body.message,
        session_id: body.session_id,
        raw_history,
        context_server: body.context_server,
    };

    let event_stream = agent.chat_stream(request).map(|result| {
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
