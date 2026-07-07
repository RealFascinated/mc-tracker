use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::Utc;
use mc_db::model::{Platform, Server};
use mc_insights::{min_span, player_count_series};
use tower::ServiceExt;
use uuid::Uuid;
use wiremock::matchers::{method, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

use mc_test_support::{
    bootstrap_admin, build_app_with_env, manager_with_vm_url, setup_pool, start_postgres,
};

fn sample_server(id: Uuid, name: &str) -> Server {
    Server {
        id,
        name: name.into(),
        host: format!("{name}.example.com"),
        port: Some(25565),
        platform: Platform::Pc,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        peak_players: None,
        peak_players_timestamp: None,
        paused: false,
    }
}

async fn mount_compare_series_mocks(vm: &MockServer, server_ids: &[Uuid]) {
    for server_id in server_ids {
        let promql = player_count_series("production", &server_id.to_string());
        Mock::given(method("GET"))
            .and(query_param("query", promql.as_str()))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "success",
                "data": {
                    "resultType": "matrix",
                    "result": [{
                        "values": [
                            [1709913600.0, "10"],
                            [1709913900.0, "12"]
                        ]
                    }]
                }
            })))
            .mount(vm)
            .await;
    }
}

#[tokio::test]
async fn get_servers_compare_timeseries_returns_lanes() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_a = Uuid::new_v4();
    let server_b = Uuid::new_v4();
    let vm = MockServer::start().await;
    mount_compare_series_mocks(&vm, &[server_a, server_b]).await;

    let manager = manager_with_vm_url(&pool, &vm.uri()).await;
    manager
        .append_server(sample_server(server_a, "Alpha"))
        .await;
    manager.append_server(sample_server(server_b, "Beta")).await;
    let app = build_app_with_env(pool, manager, "development").await;

    let from = 1709913600i64;
    let to = 1710086399i64;
    let uri = format!(
        "/servers/compare/timeseries?ids={},{}&from={from}&to={to}",
        server_a, server_b
    );

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

    assert_eq!(body["from"], from);
    assert_eq!(body["to"], to);
    assert_eq!(body["servers"].as_array().unwrap().len(), 2);
    let first = &body["servers"][0];
    assert!(first["name"].is_string());
    assert!(first["series"]["playersOnline"]["timestamps"].is_array());
}

#[tokio::test]
async fn get_servers_compare_timeseries_rejects_short_window() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_a = Uuid::new_v4();
    let server_b = Uuid::new_v4();
    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    manager
        .append_server(sample_server(server_a, "Alpha"))
        .await;
    manager.append_server(sample_server(server_b, "Beta")).await;
    let app = build_app_with_env(pool, manager, "development").await;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let too_short = min_span().as_secs() - 60;
    let uri = format!(
        "/servers/compare/timeseries?ids={},{}&from={}&to={}",
        server_a,
        server_b,
        now - too_short as i64,
        now
    );

    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
