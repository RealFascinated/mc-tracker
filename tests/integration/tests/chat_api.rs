use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use axum::response::Response;
use futures::Stream;
use mc_api_types::ChatStreamEvent;
use mc_chat::{AgentChatRequest, ChatAgent, ChatError};
use mc_db::UserRole;
use tower::ServiceExt;

use mc_test_support::{
    bootstrap_admin, build_app_with_chat, create_user, login_admin, login_as, manager_with_vm_url,
    setup_pool, start_postgres,
};

struct MockChatAgent;

impl ChatAgent for MockChatAgent {
    fn chat_stream(
        &self,
        _request: AgentChatRequest,
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
                raw_history: None,
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

fn chat_request(cookie: Option<&str>, message: &str, ip_octet: u8) -> Request<Body> {
    let mut builder = Request::builder()
        .method("POST")
        .uri("/chat")
        .header("content-type", "application/json")
        .extension(ConnectInfo(SocketAddr::from(([127, 0, 0, ip_octet], 8080))));
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    builder
        .body(Body::from(format!(r#"{{"message":"{message}"}}"#)))
        .unwrap()
}

async fn post_chat(
    app: &axum::Router,
    cookie: Option<&str>,
    message: &str,
    ip_octet: u8,
) -> Response {
    app.clone()
        .oneshot(chat_request(cookie, message, ip_octet))
        .await
        .unwrap()
}

#[tokio::test]
async fn post_chat_streams_sse_events() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_admin(&app).await;

    let response = post_chat(&app, Some(&cookie), "hi", 1).await;

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

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;

    let response = post_chat(&app, None, "hi", 1).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn post_chat_enforces_weekly_limit() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "chatuser", "pass", UserRole::User).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_as(&app, "chatuser", "pass").await;

    for i in 0..20 {
        let response = post_chat(&app, Some(&cookie), &format!("msg{i}"), i as u8 + 1).await;
        assert_eq!(
            response.status(),
            StatusCode::OK,
            "request {i} should succeed"
        );
    }

    let response = post_chat(&app, Some(&cookie), "one too many", 21).await;
    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    let events = collect_sse_json(response.into_body()).await;
    assert_eq!(events[0]["type"], "error");
    assert_eq!(events[0]["message"], "weekly message limit reached");
}

#[tokio::test]
async fn post_chat_admin_unlimited() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_admin(&app).await;

    for i in 0..21 {
        let response = post_chat(&app, Some(&cookie), &format!("admin{i}"), i as u8 + 1).await;
        assert_eq!(response.status(), StatusCode::OK, "admin request {i}");
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

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;
    let cookie = login_as(&app, "vip", "pass").await;

    for i in 0..21 {
        let response = post_chat(&app, Some(&cookie), &format!("vip{i}"), i as u8 + 1).await;
        assert_eq!(response.status(), StatusCode::OK, "flagged user request {i}");
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

    let response = post_chat(&app, Some(&cookie), "hi", 1).await;

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
}
