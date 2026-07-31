use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateServerSuggestionRequest {
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    #[serde(rename = "type")]
    pub server_type: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveServerSuggestionRequest {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    #[serde(rename = "type")]
    pub server_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSuggestionsListQuery {
    #[serde(default)]
    pub status: Option<String>,
}
