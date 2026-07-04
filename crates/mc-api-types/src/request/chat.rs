use serde::Deserialize;
use uuid::Uuid;

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
    pub session_id: Uuid,
    #[serde(default)]
    pub context_server: Option<ChatContextServer>,
}
