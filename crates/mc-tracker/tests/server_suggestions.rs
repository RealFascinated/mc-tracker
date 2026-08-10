use mc_test_support as common;

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;

const SUGGEST_BODY: &str = r#"{"name":"Hypixel","host":"mc.hypixel.net","port":null,"type":"PC"}"#;

struct TestApp {
    #[allow(dead_code)]
    _postgres: common::PostgresContainer,
    pool: mc_db::DbPool,
    app: axum::Router,
    user_cookie: String,
}

async fn build_app_with_user(username: &str) -> TestApp {
    let (postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    common::create_user(&pool, username, "password", mc_db::UserRole::User).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;
    let user_cookie = common::login_as(&app, username, "password").await;
    TestApp {
        _postgres: postgres,
        pool,
        app,
        user_cookie,
    }
}

fn suggest_request(
    app: &axum::Router,
    cookie: &str,
    body: &str,
) -> tower::util::Oneshot<axum::Router, Request<Body>> {
    app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/server-suggestions")
            .header("cookie", cookie)
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap(),
    )
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn authenticated_user_can_submit_suggestion() {
    let test = build_app_with_user("alice").await;
    let pool = &test.pool;
    let app = &test.app;

    let response = suggest_request(app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = json_body(response).await;
    assert_eq!(body["name"], "Hypixel");
    assert_eq!(body["status"], "pending");

    let stored = mc_db::db::repos::server_suggestions::list_by_status(
        pool,
        mc_db::ServerSuggestionStatus::Pending,
    )
    .await
    .unwrap();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].host, "mc.hypixel.net");
}

#[tokio::test]
async fn anonymous_submit_is_unauthorized() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/server-suggestions")
                .header("content-type", "application/json")
                .body(Body::from(SUGGEST_BODY))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn duplicate_suggestion_is_conflict() {
    let test = build_app_with_user("alice").await;

    let first = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::CREATED);

    let second = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(second.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn suggesting_tracked_server_is_conflict() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    common::create_user(&pool, "alice", "password", mc_db::UserRole::User).await;

    mc_db::db::repos::servers::insert(
        &pool,
        mc_db::db::repos::servers::NewServer {
            id: None,
            name: "Hypixel",
            host: "mc.hypixel.net",
            port: None,
            platform: mc_db::Platform::Pc,
        },
    )
    .await
    .unwrap();

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;
    let user_cookie = common::login_as(&app, "alice", "password").await;

    let response = suggest_request(&app, &user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn admin_can_list_pending_and_approve_with_changes() {
    let test = build_app_with_user("alice").await;
    let admin_cookie = common::login_admin(&test.app).await;

    let submitted = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(submitted.status(), StatusCode::CREATED);
    let id = json_body(submitted).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    let list = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/admin/server-suggestions?status=pending")
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list.status(), StatusCode::OK);
    let list_body = json_body(list).await;
    assert_eq!(list_body["suggestions"][0]["name"], "Hypixel");
    assert_eq!(list_body["suggestions"][0]["suggestedBy"]["name"], "alice");

    let approve = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/admin/server-suggestions/{id}/approve"))
                .header("cookie", &admin_cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Hypixel Renamed"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve.status(), StatusCode::OK);
    let approved = json_body(approve).await;
    assert_eq!(approved["status"], "approved");
    assert_eq!(approved["name"], "Hypixel Renamed");

    let stored = mc_db::db::repos::servers::list(&test.pool).await.unwrap();
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].name, "Hypixel Renamed");
    assert_eq!(stored[0].host, "mc.hypixel.net");

    let events = mc_db::db::repos::monitored_server_events::list_between(
        &test.pool,
        chrono::DateTime::parse_from_rfc3339("2000-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc),
        chrono::Utc::now() + chrono::Duration::days(1),
    )
    .await
    .unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event_type.as_str(), "added");
}

#[tokio::test]
async fn admin_deny_blocks_resubmission_until_removed() {
    let test = build_app_with_user("alice").await;
    let admin_cookie = common::login_admin(&test.app).await;

    let submitted = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    let id = json_body(submitted).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    let deny = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/admin/server-suggestions/{id}/deny"))
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(deny.status(), StatusCode::OK);

    let denied_list = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/admin/server-suggestions?status=denied")
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(denied_list.status(), StatusCode::OK);
    let denied_body = json_body(denied_list).await;
    assert_eq!(denied_body["suggestions"][0]["name"], "Hypixel");

    let resubmit = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(resubmit.status(), StatusCode::CONFLICT);

    let remove = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/admin/server-suggestions/{id}"))
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(remove.status(), StatusCode::NO_CONTENT);

    let resubmit_after = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(resubmit_after.status(), StatusCode::CREATED);
}

#[tokio::test]
async fn admin_approve_non_pending_is_conflict() {
    let test = build_app_with_user("alice").await;
    let admin_cookie = common::login_admin(&test.app).await;

    let submitted = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    let id = json_body(submitted).await["id"]
        .as_str()
        .unwrap()
        .to_string();

    let deny = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/admin/server-suggestions/{id}/deny"))
                .header("cookie", &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(deny.status(), StatusCode::OK);

    let approve = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/admin/server-suggestions/{id}/approve"))
                .header("cookie", &admin_cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(approve.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn non_admin_cannot_review_suggestions() {
    let test = build_app_with_user("alice").await;

    let list = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/admin/server-suggestions")
                .header("cookie", &test.user_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn my_suggestions_lists_user_submissions() {
    let test = build_app_with_user("alice").await;

    let submitted = suggest_request(&test.app, &test.user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(submitted.status(), StatusCode::CREATED);

    let mine = test
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/server-suggestions/mine")
                .header("cookie", &test.user_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(mine.status(), StatusCode::OK);
    let body = json_body(mine).await;
    assert_eq!(body["suggestions"][0]["status"], "pending");
    assert_eq!(body["suggestions"][0]["suggestedBy"], json!(null));
}

#[tokio::test]
async fn submitting_suggestion_posts_webhook_notification() {
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);
    let receiver = axum::Router::new().route(
        "/hook",
        axum::routing::post(move |body: axum::body::Bytes| async move {
            let _ = tx.send(body).await;
            StatusCode::NO_CONTENT
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, receiver).await.unwrap();
    });

    let (postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    common::create_user(&pool, "alice", "password", mc_db::UserRole::User).await;
    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app_with_discord_webhook(
        pool,
        Arc::clone(&manager),
        "development",
        Some(format!("http://{addr}/hook")),
    )
    .await;
    let user_cookie = common::login_as(&app, "alice", "password").await;
    let _postgres = postgres;

    let response = suggest_request(&app, &user_cookie, SUGGEST_BODY)
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
        .await
        .expect("webhook POST timed out")
        .expect("webhook channel closed");
    let payload: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(payload["username"], "mc-tracker");
    let embed = &payload["embeds"][0];
    assert_eq!(embed["title"], "New server suggestion: Hypixel");
    assert_eq!(embed["color"], 0x5865F2);
    assert!(embed["timestamp"].is_string());
    let fields = embed["fields"].as_array().unwrap();
    assert_eq!(fields[0]["name"], "Host");
    assert_eq!(fields[0]["value"], "mc.hypixel.net");
    assert_eq!(fields[0]["inline"], true);
    assert_eq!(fields[1]["name"], "Platform");
    assert_eq!(fields[1]["value"], "PC");
    assert_eq!(fields[1]["inline"], true);
    assert_eq!(fields[2]["name"], "Suggested by");
    assert_eq!(fields[2]["value"], "alice");
    assert!(fields[2].get("inline").is_none());
}
