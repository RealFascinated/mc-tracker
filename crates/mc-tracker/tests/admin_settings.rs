use mc_test_support as common;

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

fn setting_value<'a>(body: &'a serde_json::Value, key: &str) -> &'a serde_json::Value {
    &body["settings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["key"] == key)
        .unwrap_or_else(|| panic!("missing setting {key}"))["value"]
}

#[tokio::test]
async fn get_and_patch_admin_settings() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;

    let app = common::build_app(pool.clone(), Arc::clone(&manager)).await;
    let cookie = common::login_admin(&app).await;

    let get = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/admin/settings")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get.status(), StatusCode::OK);
    let current: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(get.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        setting_value(&current, "metrics_push_cron"),
        "*/10 * * * * *"
    );

    for (key, value) in [
        ("metrics_push_cron", r#""*/15 * * * * *""#),
        ("victoriametrics_url", r#""http://vm:8428""#),
    ] {
        let patch = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/admin/settings/{key}"))
                    .header("cookie", &cookie)
                    .header("content-type", "application/json")
                    .body(Body::from(format!(r#"{{"value":{value}}}"#)))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(patch.status(), StatusCode::OK, "patch {key}");
    }

    assert_eq!(
        manager
            .settings()
            .cached_str(mc_settings::SettingKey::MetricsPushCron),
        "*/15 * * * * *"
    );
    assert_eq!(
        manager
            .settings()
            .cached_str(mc_settings::SettingKey::VictoriametricsUrl),
        "http://vm:8428"
    );

    let cron = mc_db::db::repos::settings::get(&pool, "metrics_push_cron")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(cron, "*/15 * * * * *");
    let vm = mc_db::db::repos::settings::get(&pool, "victoriametrics_url")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(vm, "http://vm:8428");
}

#[tokio::test]
async fn patch_admin_settings_rejects_invalid_values() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, Arc::clone(&manager)).await;
    let cookie = common::login_admin(&app).await;

    let patch = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/admin/settings/metrics_push_cron")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"value":"not a cron"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(patch.status(), StatusCode::BAD_REQUEST);
}
