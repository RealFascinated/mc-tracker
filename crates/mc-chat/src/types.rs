use mc_api_types::{ChatContextServer, ChatStreamEvent};

use crate::error::ChatError;
use crate::llm::ChatMessage;

#[derive(Debug, Clone)]
pub struct AgentChatRequest {
    pub message: String,
    pub session_id: Option<String>,
    pub raw_history: Option<Vec<ChatMessage>>,
    /// Server page the user is viewing — injected per turn, not persisted in raw_history.
    pub context_server: Option<ChatContextServer>,
}

pub trait ChatAgent: Send + Sync {
    fn chat_stream(
        &self,
        request: AgentChatRequest,
    ) -> std::pin::Pin<Box<dyn futures::Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>>;
}
