use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::Utc;
use mc_db::model::{Platform, Server};
use tower::ServiceExt;
use uuid::Uuid;

use mc_test_support::{
    bootstrap_admin, build_app_with_env, create_user, login_admin, login_as,
    manager_with_vm_url, setup_pool, start_postgres,
};

fn sample_server(id: Uuid, name: &str, host: &str) -> Server {
    Server {
        id,
        name: name.into(),
        host: host.into(),
        port: Some(25565),
        platform: Platform::Pc,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        peak_players: None,
        peak_players_timestamp: None,
        paused: false,
    }
}

async fn seed_server(
    pool: &mc_db::DbPool,
    manager: &mc_tracker::manager::ServerManager,
    id: Uuid,
    name: &str,
    host: &str,
) {
    let server = sample_server(id, name, host);
    mc_db::db::repos::servers::insert(
        pool,
        mc_db::db::repos::servers::NewServer {
            id: Some(id),
            name: &server.name,
            host: &server.host,
            port: server.port,
            platform: server.platform,
        },
    )
    .await
    .unwrap();
    manager.append_server(server).await;
}

fn request(
    method: &str,
    uri: &str,
    cookie: Option<&str>,
    body: Option<String>,
) -> Request<Body> {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    if let Some(body) = body {
        builder
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    }
}

async fn json_body(response: axum::response::Response) -> serde_json::Value {
    serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap()
}

#[tokio::test]
async fn pinned_servers_requires_auth() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_env(pool, manager, "development").await;

    for (method, uri, body) in [
        ("GET", "/pinned-servers", None),
        (
            "POST",
            "/pinned-servers",
            Some(r#"{"serverId":"550e8400-e29b-41d4-a716-446655440000"}"#.into()),
        ),
        (
            "DELETE",
            "/pinned-servers/550e8400-e29b-41d4-a716-446655440000",
            None,
        ),
        (
            "PUT",
            "/pinned-servers/order",
            Some(r#"{"serverIds":[]}"#.into()),
        ),
    ] {
        let response = app
            .clone()
            .oneshot(request(method, uri, None, body))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{method} {uri}");
    }
}

#[tokio::test]
async fn pin_reorder_and_unpin_servers() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;
    create_user(&pool, "viewer", "viewerpass", mc_db::UserRole::User).await;

    let server_a = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let server_b = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap();

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    seed_server(&pool, &manager, server_a, "Alpha", "alpha.example.net").await;
    seed_server(&pool, &manager, server_b, "Bravo", "bravo.example.net").await;
    let app = build_app_with_env(pool, manager, "development").await;
    let cookie = login_as(&app, "viewer", "viewerpass").await;

    let empty = app
        .clone()
        .oneshot(request("GET", "/pinned-servers", Some(&cookie), None))
        .await
        .unwrap();
    assert_eq!(empty.status(), StatusCode::OK);
    let empty_body = json_body(empty).await;
    assert_eq!(empty_body["servers"], serde_json::json!([]));

    let pin_a = app
        .clone()
        .oneshot(request(
            "POST",
            "/pinned-servers",
            Some(&cookie),
            Some(format!(r#"{{"serverId":"{server_a}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(pin_a.status(), StatusCode::OK);
    let pin_a_body = json_body(pin_a).await;
    assert_eq!(pin_a_body["servers"].as_array().unwrap().len(), 1);
    assert_eq!(pin_a_body["servers"][0]["id"], server_a.to_string());
    assert_eq!(pin_a_body["servers"][0]["name"], "Alpha");

    let pin_b = app
        .clone()
        .oneshot(request(
            "POST",
            "/pinned-servers",
            Some(&cookie),
            Some(format!(r#"{{"serverId":"{server_b}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(pin_b.status(), StatusCode::OK);
    let pin_b_body = json_body(pin_b).await;
    assert_eq!(
        pin_b_body["servers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|server| server["id"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec![server_a.to_string(), server_b.to_string()]
    );

    let duplicate = app
        .clone()
        .oneshot(request(
            "POST",
            "/pinned-servers",
            Some(&cookie),
            Some(format!(r#"{{"serverId":"{server_a}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(duplicate.status(), StatusCode::CONFLICT);

    let reorder = app
        .clone()
        .oneshot(request(
            "PUT",
            "/pinned-servers/order",
            Some(&cookie),
            Some(format!(
                r#"{{"serverIds":["{server_b}","{server_a}"]}}"#
            )),
        ))
        .await
        .unwrap();
    assert_eq!(reorder.status(), StatusCode::OK);
    let reorder_body = json_body(reorder).await;
    assert_eq!(reorder_body["servers"][0]["id"], server_b.to_string());
    assert_eq!(reorder_body["servers"][1]["id"], server_a.to_string());

    let list = app
        .clone()
        .oneshot(request("GET", "/pinned-servers", Some(&cookie), None))
        .await
        .unwrap();
    assert_eq!(list.status(), StatusCode::OK);
    let list_body = json_body(list).await;
    assert_eq!(list_body["servers"][0]["id"], server_b.to_string());
    assert_eq!(list_body["servers"][1]["id"], server_a.to_string());

    let unpin = app
        .clone()
        .oneshot(request(
            "DELETE",
            &format!("/pinned-servers/{server_a}"),
            Some(&cookie),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(unpin.status(), StatusCode::OK);
    let unpin_body = json_body(unpin).await;
    assert_eq!(unpin_body["servers"].as_array().unwrap().len(), 1);
    assert_eq!(unpin_body["servers"][0]["id"], server_b.to_string());
}

#[tokio::test]
async fn pin_unknown_server_returns_not_found() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_env(pool, manager, "development").await;
    let cookie = login_admin(&app).await;

    let missing_id = Uuid::new_v4();
    let response = app
        .oneshot(request(
            "POST",
            "/pinned-servers",
            Some(&cookie),
            Some(format!(r#"{{"serverId":"{missing_id}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn pin_untracked_server_returns_not_found() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let server = sample_server(server_id, "Paused", "paused.example.net");
    mc_db::db::repos::servers::insert(
        &pool,
        mc_db::db::repos::servers::NewServer {
            id: Some(server_id),
            name: &server.name,
            host: &server.host,
            port: server.port,
            platform: server.platform,
        },
    )
    .await
    .unwrap();

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app_with_env(pool, manager, "development").await;
    let cookie = login_admin(&app).await;

    let response = app
        .oneshot(request(
            "POST",
            "/pinned-servers",
            Some(&cookie),
            Some(format!(r#"{{"serverId":"{server_id}"}}"#)),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
