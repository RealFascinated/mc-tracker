use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatContextServer {
    pub server_id: String,
    pub server_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub message: String,
    #[serde(default)]
    pub session_id: Option<String>,
    /// Opaque LLM message list echoed back from the previous turn's Done event.
    #[serde(default)]
    pub raw_history: Option<Vec<serde_json::Value>>,
    /// Server the user is currently viewing in the dashboard.
    #[serde(default)]
    pub context_server: Option<ChatContextServer>,
}
