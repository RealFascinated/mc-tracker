use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::Utc;
use mc_db::model::{Platform, Server};
use mc_metrics::min_span;
use tower::ServiceExt;
use uuid::Uuid;
use wiremock::matchers::{method, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

use mc_test_support::{
    bootstrap_admin, build_app_with_env, manager_with_vm_url, setup_pool, start_postgres,
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
        peak_players: None,
        peak_players_timestamp: None,
        paused: false,
    }
}

async fn mount_series_mocks(vm: &MockServer, server_id: Uuid) {
    let fine_series = mc_metrics::player_count_series("production", &server_id.to_string());

    Mock::given(method("GET"))
        .and(query_param("query", fine_series.as_str()))
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

#[tokio::test]
async fn get_server_timeseries_summary_returns_stats() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_id = Uuid::new_v4();
    let vm = MockServer::start().await;
    mount_series_mocks(&vm, server_id).await;

    let manager = manager_with_vm_url(&pool, &vm.uri()).await;
    manager.append_server(sample_server(server_id)).await;
    let app = build_app_with_env(pool, manager, "development").await;

    let from = 1709913600i64;
    let to = 1710086399i64;
    let uri = format!("/servers/{server_id}/timeseries/summary?from={from}&to={to}");

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

    assert_eq!(body["name"], "Hypixel");
    assert_eq!(body["from"], from);
    assert_eq!(body["to"], to);
    assert_eq!(body["seriesKey"], "playersOnline");
    assert_eq!(body["end"], 12.0);
    assert_eq!(body["start"], 10.0);
    assert!(!body["points"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn get_server_timeseries_summary_rejects_short_window() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;
    bootstrap_admin(&pool).await;

    let server_id = Uuid::new_v4();
    let manager = manager_with_vm_url(&pool, "http://127.0.0.1:9").await;
    manager.append_server(sample_server(server_id)).await;
    let app = build_app_with_env(pool, manager, "development").await;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let too_short = min_span().as_secs() - 60;
    let uri = format!(
        "/servers/{server_id}/timeseries/summary?from={}&to={}",
        now - too_short as i64,
        now
    );

    let response = app
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
