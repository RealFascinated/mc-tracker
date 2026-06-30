mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::sync::Arc;
use mc_tracker::manager::ServerManager;
use tokio::sync::RwLock;
use tower::ServiceExt;

#[tokio::test]
async fn login_me_logout_flow() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        settings,
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));
    let app = common::build_app(pool, manager).await;
    let cookie = common::login_admin(&app).await;

    let me = app
        .clone()
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
    let body: serde_json::Value =
        serde_json::from_slice(&axum::body::to_bytes(me.into_body(), usize::MAX).await.unwrap())
            .unwrap();
    assert_eq!(body["username"], "admin");
    assert_eq!(body["role"], "admin");

    let logout = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/logout")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(logout.status(), StatusCode::NO_CONTENT);

    let me_after = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me_after.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn admin_routes_require_auth() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        settings,
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));
    let app = common::build_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/admin/servers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn public_servers_stay_public() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        settings,
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));
    let app = common::build_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/servers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}
