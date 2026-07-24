use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitoredServerEventResponse {
    pub id: String,
    pub server_id: String,
    pub server_name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub event_type: String,
    pub occurred_at: i64,
}
