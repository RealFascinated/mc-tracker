use mc_api_types::{ChatContextServer, ChatStreamEvent};

use crate::config::AgentConfig;
use crate::error::ChatError;
use crate::llm::ChatMessage;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone)]
pub struct AgentChatRequest {
    pub message: String,
    pub session_id: Option<String>,
    pub history: Vec<ChatMessage>,
    pub context_server: Option<ChatContextServer>,
}

pub trait ChatAgent: Send + Sync {
    fn chat_stream(
        &self,
        request: AgentChatRequest,
        config: AgentConfig,
        cancel: CancellationToken,
    ) -> std::pin::Pin<Box<dyn futures::Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>>;
}
