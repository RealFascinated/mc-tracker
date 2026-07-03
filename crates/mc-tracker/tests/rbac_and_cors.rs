use mc_test_support as common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mc_db::UserRole;
use mc_tracker::manager::ServerManager;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceExt;

async fn test_app() -> (
    mc_test_support::PostgresContainer,
    axum::Router,
    Arc<ServerManager>,
    mc_db::DbPool,
) {
    let (postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let settings = Arc::new(RwLock::new(
        mc_db::db::repos::settings::load_all(&pool).await.unwrap(),
    ));
    let bootstrap = settings.read().await.clone();
    let manager = Arc::new(ServerManager::new(
        vec![],
        None,
        Arc::clone(&settings),
        common::fixture_geo(),
        None,
        &bootstrap,
        "development",
    ));
    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;
    (postgres, app, manager, pool)
}

#[tokio::test]
async fn non_admin_forbidden_on_admin_routes() {
    let (_postgres, app, _manager, pool) = test_app().await;
    common::create_user(&pool, "viewer", "viewerpass", UserRole::User).await;
    let cookie = common::login_as(&app, "viewer", "viewerpass").await;

    for uri in ["/admin/servers", "/admin/settings"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN, "GET {uri}");
    }

    let patch = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"metricsPushCron":"*/30 * * * * *"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn admin_settings_require_auth() {
    let (_postgres, app, _manager, _pool) = test_app().await;

    let get = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/admin/settings")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get.status(), StatusCode::UNAUTHORIZED);

    let patch = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"metricsPushCron":"*/30 * * * * *"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn cors_allows_vite_origin_in_development() {
    let (_postgres, app, _manager, _pool) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/servers?sort=players&order=desc")
                .header("origin", "http://localhost:5173")
                .header("access-control-request-method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .unwrap(),
        "http://localhost:5173"
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-credentials")
            .unwrap(),
        "true"
    );
}

#[tokio::test]
async fn cors_blocks_unknown_origin() {
    let (_postgres, app, _manager, _pool) = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/servers?sort=players&order=desc")
                .header("origin", "http://evil.example")
                .header("access-control-request-method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert!(
        response
            .headers()
            .get("access-control-allow-origin")
            .is_none(),
        "unexpected CORS header for disallowed origin"
    );
}

#[tokio::test]
async fn patch_settings_persists_www_origin() {
    let (_postgres, app, manager, pool) = test_app().await;
    let cookie = common::login_admin(&app).await;

    let patch = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"wwwOrigin":"https://tracker.example.com"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::OK);
    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(patch.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(body["wwwOrigin"], "https://tracker.example.com");

    assert_eq!(
        manager.settings().await.www_origin,
        "https://tracker.example.com"
    );
    let from_db = mc_db::db::repos::settings::load_all(&pool).await.unwrap();
    assert_eq!(from_db.www_origin, "https://tracker.example.com");
}

#[tokio::test]
async fn demoted_admin_loses_admin_access_on_next_request() {
    let (_postgres, app, _manager, pool) = test_app().await;
    let cookie = common::login_admin(&app).await;

    let admin = mc_db::db::repos::users::get_by_username(&pool, "admin")
        .await
        .unwrap();
    mc_db::db::repos::users::update_role(&pool, admin.id, mc_db::UserRole::User)
        .await
        .unwrap();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
