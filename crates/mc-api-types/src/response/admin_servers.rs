use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminServersListResponse {
    pub servers: Vec<AdminServerResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminServerResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub host: String,
    pub port: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
    pub paused: bool,
    pub players_online: Option<u32>,
}
