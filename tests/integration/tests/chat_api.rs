use std::pin::Pin;
use std::sync::Mutex as StdMutex;
use std::sync::{Arc, LazyLock};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::response::Response;
use futures::Stream;
use mc_api_types::{ChatStreamEvent, ChatTokenUsage};
use mc_chat::{AgentChatRequest, AgentConfig, ChatAgent, ChatError};
use mc_db::UserRole;
use tokio_util::sync::CancellationToken;
use tower::ServiceExt;
use uuid::Uuid;

use mc_test_support::{
    bootstrap_admin, build_app_with_chat, create_user, login_admin, login_as, manager_with_vm_url,
    setup_pool, start_postgres,
};

static CHAT_ENV_LOCK: LazyLock<StdMutex<()>> = LazyLock::new(|| StdMutex::new(()));

fn lock_chat_env() -> std::sync::MutexGuard<'static, ()> {
    CHAT_ENV_LOCK.lock().unwrap()
}

struct MockChatAgent;

impl ChatAgent for MockChatAgent {
    fn chat_stream(
        &self,
        _request: AgentChatRequest,
        _config: AgentConfig,
        _cancel: CancellationToken,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>> {
        let events = vec![
            Ok(ChatStreamEvent::Delta {
                content: "Hello".into(),
            }),
            Ok(ChatStreamEvent::Delta {
                content: "!".into(),
            }),
            Ok(ChatStreamEvent::Done {
                tool_calls: vec![],
                usage: None,
                truncated: false,
                finish_reason: None,
                quota_used: None,
            }),
        ];
        Box::pin(futures::stream::iter(events))
    }
}

struct ErrorChatAgent;

impl ChatAgent for ErrorChatAgent {
    fn chat_stream(
        &self,
        _request: AgentChatRequest,
        _config: AgentConfig,
        _cancel: CancellationToken,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>> {
        Box::pin(futures::stream::iter(vec![Ok(ChatStreamEvent::Error {
            message: "agent failed".into(),
        })]))
    }
}

struct UsageTrackingChatAgent;

impl ChatAgent for UsageTrackingChatAgent {
    fn chat_stream(
        &self,
        request: AgentChatRequest,
        config: AgentConfig,
        _cancel: CancellationToken,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>> {
        let usage = ChatTokenUsage {
            prompt_tokens: 120,
            completion_tokens: 30,
            context_max: config.context_max,
            turn_total_tokens: 150,
            session_total_tokens: request.session_tokens_used + 150,
            cached_tokens: None,
            cache_write_tokens: None,
            reasoning_tokens: None,
        };
        let events = vec![
            Ok(ChatStreamEvent::Delta {
                content: "ok".into(),
            }),
            Ok(ChatStreamEvent::Usage {
                usage: usage.clone(),
            }),
            Ok(ChatStreamEvent::Done {
                tool_calls: vec![],
                usage: Some(usage),
                truncated: false,
                finish_reason: None,
                quota_used: None,
            }),
        ];
        Box::pin(futures::stream::iter(events))
    }
}

async fn collect_sse_json(body: Body) -> Vec<serde_json::Value> {
    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    let text = String::from_utf8(bytes.to_vec()).unwrap();
    text.split("\n\n")
        .filter_map(|block| {
            let data = block
                .lines()
                .find(|line| line.starts_with("data: "))?
                .trim_start_matches("data: ");
            serde_json::from_str(data).ok()
        })
        .collect()
}

fn chat_request(cookie: Option<&str>, message: &str, session_id: Uuid) -> Request<Body> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/chat")
        .header("content-type", "application/json");
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    builder
        .body(Body::from(format!(
            r#"{{"message":"{message}","sessionId":"{session_id}"}}"#
        )))
        .unwrap()
}

async fn drain_chat(response: Response) -> (StatusCode, Vec<serde_json::Value>) {
    let status = response.status();
    let events = if status == StatusCode::OK || status == StatusCode::TOO_MANY_REQUESTS {
        collect_sse_json(response.into_body()).await
    } else {
        vec![]
    };
    (status, events)
}

async fn post_chat(
    app: &axum::Router,
    cookie: Option<&str>,
    message: &str,
    session_id: Uuid,
) -> Response {
    app.clone()
        .oneshot(chat_request(cookie, message, session_id))
        .await
        .unwrap()
}

async fn post_chat_drained(
    app: &axum::Router,
    cookie: Option<&str>,
    message: &str,
    session_id: Uuid,
) -> (StatusCode, Vec<serde_json::Value>) {
    drain_chat(post_chat(app, cookie, message, session_id).await).await
}

fn configure_chat_rate_limit(limit: u32) {
    let _guard = lock_chat_env();
    std::env::set_var("CHAT_RATE_LIMIT_PER_MINUTE", limit.to_string());
}

async fn enable_chat(pool: &mc_db::DbPool) {
    configure_chat_rate_limit(100);
    mc_db::db::repos::settings::set(pool, "llm_base_url", "http://127.0.0.1:9")
        .await
        .unwrap();
}

#[tokio::test]
async fn post_chat_streams_sse_events() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_admin(&app).await;
    let session_id = Uuid::new_v4();

    let response = post_chat(&app, Some(&cookie), "hi", session_id).await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap(),
        "text/event-stream"
    );

    let events = collect_sse_json(response.into_body()).await;
    assert!(events.len() >= 3);
    assert_eq!(events[0]["type"], "delta");
    assert_eq!(events[0]["content"], "Hello");
    assert_eq!(events.last().unwrap()["type"], "done");
}

#[tokio::test]
async fn post_chat_requires_auth() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;

    let response = post_chat(&app, None, "hi", Uuid::new_v4()).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn post_chat_enforces_weekly_limit() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "chatuser", "pass", UserRole::User).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_as(&app, "chatuser", "pass").await;

    for i in 0..20 {
        let (status, _) =
            post_chat_drained(&app, Some(&cookie), &format!("msg{i}"), Uuid::new_v4()).await;
        assert_eq!(status, StatusCode::OK, "request {i} should succeed");
    }

    let (status, events) =
        post_chat_drained(&app, Some(&cookie), "one too many", Uuid::new_v4()).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(events[0]["type"], "error");
    assert_eq!(events[0]["message"], "weekly message limit reached");
}

#[tokio::test]
async fn post_chat_admin_unlimited() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_admin(&app).await;

    for i in 0..21 {
        let (status, _) =
            post_chat_drained(&app, Some(&cookie), &format!("admin{i}"), Uuid::new_v4()).await;
        assert_eq!(status, StatusCode::OK, "admin request {i}");
    }
}

#[tokio::test]
async fn me_includes_chat_quota_for_users_not_admins() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "chatuser", "pass", UserRole::User).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;

    let user_cookie = login_as(&app, "chatuser", "pass").await;
    let user_me = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &user_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(user_me.status(), StatusCode::OK);
    let user_body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(user_me.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(user_body["chatQuota"]["used"], 0);
    assert_eq!(user_body["chatQuota"]["limit"], 20);
    assert!(user_body["chatQuota"]["resetsAt"].is_string());
    assert_eq!(user_body["flags"], 0);

    let admin_cookie = login_admin(&app).await;
    let admin_me = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(admin_me.status(), StatusCode::OK);
    let admin_body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(admin_me.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert!(admin_body.get("chatQuota").is_none());
    assert_eq!(admin_body["flags"], 0);
}

#[tokio::test]
async fn post_chat_flagged_user_unlimited() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "vip", "pass", UserRole::User).await;
    let user = mc_db::db::repos::users::get_by_username(&pool, "vip")
        .await
        .unwrap();
    mc_db::db::repos::users::update_flags(&pool, user.id, mc_db::UserFlags::UNLIMITED_CHAT)
        .await
        .unwrap();

    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_as(&app, "vip", "pass").await;

    for i in 0..21 {
        let (status, _) =
            post_chat_drained(&app, Some(&cookie), &format!("vip{i}"), Uuid::new_v4()).await;
        assert_eq!(status, StatusCode::OK, "flagged user request {i}");
    }
}

#[tokio::test]
async fn me_omits_chat_quota_for_flagged_user() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "vip", "pass", UserRole::User).await;
    let user = mc_db::db::repos::users::get_by_username(&pool, "vip")
        .await
        .unwrap();
    mc_db::db::repos::users::update_flags(&pool, user.id, mc_db::UserFlags::UNLIMITED_CHAT)
        .await
        .unwrap();

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_as(&app, "vip", "pass").await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert!(body.get("chatQuota").is_none());
    assert_eq!(body["flags"], 1);
}

#[tokio::test]
async fn post_chat_returns_503_when_unconfigured() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = mc_test_support::build_app_with_env(pool, manager, "development").await;
    let cookie = login_admin(&app).await;

    let response = post_chat(&app, Some(&cookie), "hi", Uuid::new_v4()).await;

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn chat_session_ownership_enforced() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "alice", "pass", UserRole::User).await;
    create_user(&pool, "bob", "pass", UserRole::User).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let alice = login_as(&app, "alice", "pass").await;
    let bob = login_as(&app, "bob", "pass").await;
    let session_id = Uuid::new_v4();

    let response = post_chat(&app, Some(&alice), "hello", session_id).await;
    assert_eq!(response.status(), StatusCode::OK);

    let bob_get = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/chat/sessions/{session_id}"))
                .header("cookie", &bob)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bob_get.status(), StatusCode::NOT_FOUND);

    let alice_list = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/chat/sessions")
                .header("cookie", &alice)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(alice_list.status(), StatusCode::OK);
    let list: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(alice_list.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(list["sessions"].as_array().unwrap().len(), 1);
    assert_eq!(
        list["sessions"][0]["sessionId"].as_str().unwrap(),
        session_id.to_string()
    );
}

#[tokio::test]
async fn post_chat_error_does_not_increment_quota() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "chatuser", "pass", UserRole::User).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(
        pool.clone(),
        manager,
        "development",
        Arc::new(ErrorChatAgent),
    )
    .await;
    let cookie = login_as(&app, "chatuser", "pass").await;

    let since = mc_tracker::chat_quota::calendar_week_start_utc(chrono::Utc::now());
    let before = mc_db::db::repos::chat_messages::count_since(
        &pool,
        {
            let user = mc_db::db::repos::users::get_by_username(&pool, "chatuser")
                .await
                .unwrap();
            user.id
        },
        since,
    )
    .await
    .unwrap();

    let response = post_chat(&app, Some(&cookie), "fail", Uuid::new_v4()).await;
    assert_eq!(response.status(), StatusCode::OK);
    let events = collect_sse_json(response.into_body()).await;
    assert_eq!(events[0]["type"], "error");

    let user = mc_db::db::repos::users::get_by_username(&pool, "chatuser")
        .await
        .unwrap();
    let after = mc_db::db::repos::chat_messages::count_since(&pool, user.id, since)
        .await
        .unwrap();
    assert_eq!(before, after);
}

#[tokio::test]
async fn post_chat_rate_limit_per_user() {
    configure_chat_rate_limit(2);
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    mc_db::db::repos::settings::set(&pool, "llm_base_url", "http://127.0.0.1:9")
        .await
        .unwrap();

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_admin(&app).await;

    for i in 0..2 {
        let (status, _) =
            post_chat_drained(&app, Some(&cookie), &format!("r{i}"), Uuid::new_v4()).await;
        assert_eq!(status, StatusCode::OK, "request {i}");
    }

    let (status, events) = post_chat_drained(&app, Some(&cookie), "blocked", Uuid::new_v4()).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(events[0]["type"], "error");
    assert_eq!(events[0]["message"], "rate limit exceeded");
}

#[tokio::test]
async fn session_tokens_persist_and_return_on_load() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    enable_chat(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(
        pool.clone(),
        manager,
        "development",
        Arc::new(UsageTrackingChatAgent),
    )
    .await;
    let cookie = login_admin(&app).await;
    let session_id = Uuid::new_v4();

    let (status, events) = post_chat_drained(&app, Some(&cookie), "count me", session_id).await;
    assert_eq!(status, StatusCode::OK);
    assert!(events.iter().any(|e| e["type"] == "usage"));

    let detail = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/chat/sessions/{session_id}"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(detail.status(), StatusCode::OK);
    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(detail.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(body["tokensUsed"], 150);
    assert_eq!(body["lastPromptTokens"], 120);

    let (status2, _) = post_chat_drained(&app, Some(&cookie), "again", session_id).await;
    assert_eq!(status2, StatusCode::OK);

    let detail2 = app
        .oneshot(
            Request::builder()
                .uri(format!("/chat/sessions/{session_id}"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let body2: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(detail2.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(body2["tokensUsed"], 300);
}
