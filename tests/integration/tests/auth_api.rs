use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mc_tracker::manager::ServerManager;
use tower::ServiceExt;

use mc_test_support::{
    bootstrap_admin, build_app_with_env, enable_sign_up, manager_with_vm_url_env, setup_pool,
    start_postgres,
};

fn public_sign_up_enabled(body: &serde_json::Value) -> bool {
    body["settings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["key"] == "sign_up_enabled")
        .unwrap()["value"]
        .as_bool()
        .unwrap()
}

async fn production_app(pool: mc_db::DbPool, manager: Arc<ServerManager>) -> axum::Router {
    manager
        .settings()
        .update(
            "www_origin",
            serde_json::json!("https://tracker.example.com"),
        )
        .await
        .unwrap();
    build_app_with_env(pool, manager, "production").await
}

#[tokio::test]
async fn public_settings_sign_up_disabled_by_default_in_development() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "development").await;
    let app = build_app_with_env(pool, manager, "development").await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/settings/public")
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
    assert!(!public_sign_up_enabled(&body));
}

#[tokio::test]
async fn public_settings_sign_up_false_in_production_when_disabled() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "production").await;
    let app = production_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/settings/public")
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
    assert!(!public_sign_up_enabled(&body));
}

#[tokio::test]
async fn signup_disabled_in_production_returns_forbidden() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "production").await;
    let app = production_app(pool, manager).await;

    let body = serde_json::json!({ "username": "newbie", "password": "secret" });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn signup_allowed_in_development_even_when_disabled_in_db() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "development").await;
    let app = build_app_with_env(pool, manager, "development").await;

    let body = serde_json::json!({ "username": "devuser", "password": "secret" });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn signup_succeeds_when_enabled_in_production() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "production").await;
    enable_sign_up(&pool, &manager).await;
    let app = production_app(pool, manager).await;

    let body = serde_json::json!({ "username": "produser", "password": "secret" });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn signup_creates_user_and_session() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "production").await;
    enable_sign_up(&pool, &manager).await;
    let app = production_app(pool, manager).await;

    let body = serde_json::json!({ "username": "newbie", "password": "secret" });
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let cookie = response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();

    let login_body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(login_body["username"], "newbie");
    assert_eq!(login_body["role"], "user");

    let me = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me.status(), StatusCode::OK);
    let me_body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(me.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(me_body["username"], "newbie");
    assert_eq!(me_body["role"], "user");
    assert_eq!(me_body["chatQuota"]["used"], 0);
    assert_eq!(me_body["chatQuota"]["limit"], 20);
    assert_eq!(me_body["flags"], 0);
}

#[tokio::test]
async fn signup_duplicate_username_returns_conflict() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url_env(&pool, "http://127.0.0.1:9", "development").await;
    let app = build_app_with_env(pool, manager, "development").await;

    let body = serde_json::json!({ "username": "newbie", "password": "secret" });
    let first = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(first.status(), StatusCode::OK);

    let second = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/signup")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second.status(), StatusCode::CONFLICT);
}
