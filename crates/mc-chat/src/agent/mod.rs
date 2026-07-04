mod context;
mod runner;
mod stream;
mod tools_exec;

use std::pin::Pin;
use std::sync::Arc;

use futures::Stream;
use mc_api_types::ChatStreamEvent;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;

use crate::config::AgentConfig;
use crate::error::ChatError;
use crate::tools::ToolRegistry;
use crate::traits::{ChatToolDeps, LlmClient};
use crate::types::{AgentChatRequest, ChatAgent};

pub struct AgentLoop {
    llm: Arc<dyn LlmClient>,
    tools: ToolRegistry,
    deps: ChatToolDeps,
}

impl AgentLoop {
    pub fn new(llm: Arc<dyn LlmClient>, tools: ToolRegistry, deps: ChatToolDeps) -> Self {
        Self { llm, tools, deps }
    }
}

impl ChatAgent for AgentLoop {
    fn chat_stream(
        &self,
        request: AgentChatRequest,
        config: AgentConfig,
        cancel: CancellationToken,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>> {
        let llm = Arc::clone(&self.llm);
        let tools = self.tools.clone();
        let deps = ChatToolDeps {
            tracker: Arc::clone(&self.deps.tracker),
            insights: Arc::clone(&self.deps.insights),
        };
        let (tx, rx) = mpsc::channel(64);
        tokio::spawn(async move {
            let result =
                runner::run_unified_agent(llm, tools, deps, config, request, tx.clone(), cancel)
                    .await;
            if let Err(err) = result {
                let _ = tx.send(Err(err)).await;
            }
            drop(tx);
        });
        Box::pin(ReceiverStream::new(rx))
    }
}
