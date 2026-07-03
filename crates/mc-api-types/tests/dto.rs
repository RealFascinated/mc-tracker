use mc_api_types::request::auth::{ChangePasswordRequest, LoginRequest};
use mc_api_types::request::servers::{
    CreateServerRequest, ServersListQuery, ServersListSortField, SortOrder, UpdateServerRequest,
};
use mc_api_types::request::settings::PatchSettingsRequest;
use mc_api_types::response::admin_servers::AdminServerResponse;
use mc_api_types::response::auth::{LoginResponse, MeResponse};
use mc_api_types::response::settings::SettingsResponse;
use mc_api_types::{ErrorResponse, HealthResponse};

#[test]
fn health_response_serializes_camel_case() {
    let json = serde_json::to_string(&HealthResponse::ok(true, true)).unwrap();
    assert_eq!(json, r#"{"status":"ok","db":true,"maxmind":true}"#);
}

#[test]
fn error_response_serializes_camel_case() {
    let json = serde_json::to_string(&ErrorResponse::new("not found")).unwrap();
    assert_eq!(json, r#"{"error":"not found"}"#);
}

#[test]
fn login_request_deserializes_camel_case() {
    let req: LoginRequest =
        serde_json::from_str(r#"{"username":"admin","password":"secret"}"#).unwrap();
    assert_eq!(req.username, "admin");
    assert_eq!(req.password, "secret");
}

#[test]
fn change_password_request_deserializes_camel_case() {
    let req: ChangePasswordRequest =
        serde_json::from_str(r#"{"currentPassword":"old","newPassword":"new"}"#).unwrap();
    assert_eq!(req.current_password, "old");
    assert_eq!(req.new_password, "new");
}

#[test]
fn me_response_serializes_camel_case() {
    let json = serde_json::to_string(&MeResponse {
        username: "admin".into(),
        role: "admin".into(),
        flags: 0,
        chat_quota: None,
    })
    .unwrap();
    assert_eq!(json, r#"{"username":"admin","role":"admin","flags":0}"#);
}

#[test]
fn create_server_request_deserializes_camel_case() {
    let req: CreateServerRequest = serde_json::from_str(
        r#"{"name":"Hypixel","host":"mc.hypixel.net","port":null,"type":"PC"}"#,
    )
    .unwrap();
    assert_eq!(req.name, "Hypixel");
    assert_eq!(req.host, "mc.hypixel.net");
    assert!(req.port.is_none());
    assert_eq!(req.server_type, "PC");
}

#[test]
fn update_server_request_deserializes_partial_fields() {
    let req: UpdateServerRequest =
        serde_json::from_str(r#"{"name":"New Name","port":25565}"#).unwrap();
    assert_eq!(req.name.as_deref(), Some("New Name"));
    assert!(req.host.is_none());
    assert_eq!(req.port, Some(25565));
    assert!(req.server_type.is_none());
    assert!(req.paused.is_none());
}

#[test]
fn update_server_request_deserializes_paused() {
    let req: UpdateServerRequest = serde_json::from_str(r#"{"paused":true}"#).unwrap();
    assert_eq!(req.paused, Some(true));
}

#[test]
fn admin_server_response_serializes_camel_case() {
    let json = serde_json::to_string(&AdminServerResponse {
        id: "b8dd1998-c3c8-4248-905c-52c26092baf5".into(),
        name: "Hypixel".into(),
        server_type: "PC".into(),
        host: "mc.hypixel.net".into(),
        port: None,
        created_at: "2026-06-30T12:00:00Z".into(),
        updated_at: "2026-06-30T12:00:00Z".into(),
        paused: false,
    })
    .unwrap();
    assert_eq!(
        json,
        r#"{"id":"b8dd1998-c3c8-4248-905c-52c26092baf5","name":"Hypixel","type":"PC","host":"mc.hypixel.net","port":null,"createdAt":"2026-06-30T12:00:00Z","updatedAt":"2026-06-30T12:00:00Z","paused":false}"#
    );
}

#[test]
fn login_response_serializes_camel_case() {
    let json = serde_json::to_string(&LoginResponse {
        username: "user".into(),
        role: "user".into(),
    })
    .unwrap();
    assert_eq!(json, r#"{"username":"user","role":"user"}"#);
}

#[test]
fn settings_response_serializes_camel_case() {
    let json = serde_json::to_string(&SettingsResponse {
        pinger_timeout_ms: 5000,
        pinger_retry_attempts: 3,
        pinger_retry_delay_ms: 1000,
        dns_cache_enabled: true,
        dns_cache_ttl_minutes: 5,
        victoriametrics_url: "http://localhost:8428".into(),
        metrics_push_cron: "*/10 * * * * *".into(),
        sign_up_enabled: false,
        www_origin: String::new(),
    })
    .unwrap();
    assert!(json.contains(r#""pingerTimeoutMs":5000"#));
    assert!(json.contains(r#""dnsCacheEnabled":true"#));
    assert!(json.contains(r#""victoriametricsUrl":"http://localhost:8428""#));
}

#[test]
fn patch_settings_request_deserializes_partial_fields() {
    let req: PatchSettingsRequest =
        serde_json::from_str(r#"{"metricsPushCron":"*/30 * * * * *","dnsCacheEnabled":false}"#)
            .unwrap();
    assert_eq!(req.metrics_push_cron, Some("*/30 * * * * *".into()));
    assert_eq!(req.dns_cache_enabled, Some(false));
    assert!(req.pinger_timeout_ms.is_none());
}

#[test]
fn servers_list_query_deserializes_sort_and_order() {
    let query: ServersListQuery =
        serde_json::from_str(r#"{"sort":"name","order":"asc"}"#).unwrap();
    assert_eq!(query.sort, ServersListSortField::Name);
    assert_eq!(query.order, SortOrder::Asc);
}

#[test]
fn servers_list_query_requires_sort_and_order() {
    assert!(serde_json::from_str::<ServersListQuery>(r#"{}"#).is_err());
    assert!(serde_json::from_str::<ServersListQuery>(r#"{"sort":"name"}"#).is_err());
}
