pub mod agent;
pub mod error;
pub mod llm;
pub mod prompt;
pub mod tools;
pub mod traits;
pub mod types;

pub use agent::AgentLoop;
pub use error::ChatError;
pub use llm::ChatMessage;
pub use llm::OpenAiLlmClient;
pub use tools::ToolRegistry;
pub use traits::{ChatToolDeps, InsightsRead, LlmClient, TrackerRead};
pub use types::{AgentChatRequest, ChatAgent};
