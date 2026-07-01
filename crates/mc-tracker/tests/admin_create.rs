use mc_test_support as common;

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use mc_tracker::manager::ServerManager;
use tokio::sync::RwLock;
use tower::ServiceExt;

#[tokio::test]
async fn post_admin_server_persists_and_updates_memory() {
    let (_postgres, database_url) = common::start_postgres().await;
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
    let cookie = common::login_admin(&app).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/admin/servers")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"name":"Mineplex","host":"mineplex.com","port":null,"type":"PC"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["name"], "Mineplex");
    assert_eq!(json["type"], "PC");

    assert_eq!(manager.summary().await.tracked_servers, 1);
    let db_servers = mc_db::db::repos::servers::list(&pool).await.unwrap();
    assert_eq!(db_servers.len(), 1);
    assert_eq!(db_servers[0].name, "Mineplex");
}

#[tokio::test]
async fn patch_and_delete_admin_server() {
    let (_postgres, database_url) = common::start_postgres().await;
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
    let cookie = common::login_admin(&app).await;

    let create = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/admin/servers")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"name":"Mineplex","host":"mineplex.com","port":null,"type":"PC"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create.status(), StatusCode::CREATED);
    let created: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(create.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let id = created["id"].as_str().unwrap();

    let patch = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/admin/servers/{id}"))
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Mineplex Renamed"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::OK);
    let patched: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(patch.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(patched["name"], "Mineplex Renamed");

    let delete = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/admin/servers/{id}"))
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete.status(), StatusCode::NO_CONTENT);
    assert_eq!(manager.summary().await.tracked_servers, 0);
    assert!(mc_db::db::repos::servers::list(&pool)
        .await
        .unwrap()
        .is_empty());
}
