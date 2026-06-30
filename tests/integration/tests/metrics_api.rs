use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::Utc;
use mc_db::model::{Platform, Server};
use mc_metrics::{peak_players_24h, peak_players_30d, player_count_series};
use tower::ServiceExt;
use uuid::Uuid;
use wiremock::matchers::{method, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

use mc_integration_tests::{
    api_fixture_path, bootstrap_admin, build_app, load_api_fixture, manager_with_vm_url,
    setup_pool, start_postgres,
};

fn sample_server(id: Uuid) -> Server {
    Server {
        id,
        name: "Hypixel".into(),
        host: "mc.hypixel.net".into(),
        port: Some(25565),
        platform: Platform::Pc,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

async fn mount_vm_mocks(vm: &MockServer, server_id: Uuid) {
    let peak_24h = peak_players_24h("production");
    let peak_30d = peak_players_30d("production");
    let series = player_count_series("production", &server_id.to_string());

    Mock::given(method("GET"))
        .and(query_param("query", peak_24h.as_str()))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [{ "value": [1710000000.0, "1500"] }]
            }
        })))
        .mount(vm)
        .await;

    Mock::given(method("GET"))
        .and(query_param("query", peak_30d.as_str()))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [{ "value": [1710000000.0, "2100"] }]
            }
        })))
        .mount(vm)
        .await;

    Mock::given(method("GET"))
        .and(query_param("query", series.as_str()))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "status": "success",
            "data": {
                "resultType": "matrix",
                "result": [{
                    "values": [
                        [1710000000.0, "10"],
                        [1710000015.0, "12"],
                        [1710000030.0, "null"]
                    ]
                }]
            }
        })))
        .mount(vm)
        .await;
}

#[tokio::test]
async fn get_servers_matches_empty_fixture_and_vm_peaks() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let vm = MockServer::start().await;
    mount_vm_mocks(&vm, Uuid::new_v4()).await;

    let manager = manager_with_vm_url(&pool, &vm.uri()).await;
    let app = build_app(pool, Arc::clone(&manager), "development").await;

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

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();

    let expected = load_api_fixture("servers-list-empty.json");
    assert_eq!(
        body["summary"]["totalPlayers"],
        expected["summary"]["totalPlayers"]
    );
    assert_eq!(
        body["summary"]["trackedServers"],
        expected["summary"]["trackedServers"]
    );
    assert_eq!(body["servers"], expected["servers"]);
    assert_eq!(body["summary"]["peakPlayers24h"], 1500.0);
    assert_eq!(body["summary"]["peakPlayers30d"], 2100.0);
}

#[tokio::test]
async fn get_servers_timeseries_returns_aligned_series() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
    let server = sample_server(server_id);
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

    let vm = MockServer::start().await;
    mount_vm_mocks(&vm, server_id).await;

    let manager = manager_with_vm_url(&pool, &vm.uri()).await;
    manager.append_server(server).await;
    let app = build_app(pool, manager, "development").await;

    let from = 1710000000i64;
    let to = 1710003600i64;
    let uri = format!("/servers/{server_id}/timeseries?from={from}&to={to}");

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();

    let fixture = load_api_fixture("servers-timeseries-sample.json");
    assert_eq!(body["id"], fixture["id"]);
    assert_eq!(body["step"], fixture["step"]);
    assert!(body["timestamps"].as_array().unwrap().len() <= 400);
    assert_eq!(
        body["timestamps"].as_array().unwrap().len(),
        body["playersOnline"].as_array().unwrap().len()
    );
    assert_eq!(body["playersOnline"][0], 10.0);
    assert_eq!(body["playersOnline"][1], 12.0);
    assert!(body["playersOnline"][2].is_null());
}

#[tokio::test]
async fn get_servers_timeseries_rejects_short_window() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_id = Uuid::new_v4();
    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    manager.append_server(sample_server(server_id)).await;
    let app = build_app(pool, manager, "development").await;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let uri = format!(
        "/servers/{server_id}/timeseries?from={}&to={}",
        now - 60,
        now
    );

    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn get_servers_timeseries_unknown_server_returns_400() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    let app = build_app(pool, manager, "development").await;

    let id = Uuid::new_v4();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let uri = format!("/servers/{id}/timeseries?from={}&to={}", now - 3600, now);

    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[test]
fn api_fixtures_are_checked_in() {
    assert!(api_fixture_path("servers-list-empty.json").is_file());
    assert!(api_fixture_path("servers-timeseries-sample.json").is_file());
}
