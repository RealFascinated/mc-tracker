use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSuggestionResponse {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    #[serde(rename = "type")]
    pub server_type: String,
    pub status: String,
    pub suggested_by: Option<SuggestionAuthorResponse>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionAuthorResponse {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerSuggestionsListResponse {
    pub suggestions: Vec<ServerSuggestionResponse>,
}
