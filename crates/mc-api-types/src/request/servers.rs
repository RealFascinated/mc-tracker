use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateServerRequest {
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    #[serde(rename = "type")]
    pub server_type: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateServerRequest {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    #[serde(rename = "type")]
    pub server_type: Option<String>,
    pub paused: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersListQuery {
    #[serde(default)]
    pub search: Option<String>,
}

fn default_servers_search_limit() -> u32 {
    10
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServersSearchQuery {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default = "default_servers_search_limit")]
    pub limit: u32,
}
