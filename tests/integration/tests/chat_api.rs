use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use futures::Stream;
use mc_api_types::ChatStreamEvent;
use mc_chat::{AgentChatRequest, ChatAgent, ChatError};
use tower::ServiceExt;

use mc_test_support::{
    bootstrap_admin, build_app_with_chat, manager_with_vm_url, setup_pool, start_postgres,
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

fn test_connect_info() -> ConnectInfo<SocketAddr> {
    ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 8080)))
}

#[tokio::test]
async fn post_chat_streams_sse_events() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_chat(pool, manager, "development", Arc::new(MockChatAgent)).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/chat")
                .header("content-type", "application/json")
                .extension(test_connect_info())
                .body(Body::from(r#"{"message":"hi"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

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
async fn post_chat_returns_503_when_unconfigured() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = mc_test_support::build_app_with_env(pool, manager, "development").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/chat")
                .header("content-type", "application/json")
                .extension(test_connect_info())
                .body(Body::from(r#"{"message":"hi"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
}
