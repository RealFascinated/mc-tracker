use std::sync::Arc;
use std::time::Duration;

use mc_chat::tools::ToolRegistry;
use mc_chat::{AgentLoop, ChatAgent, ChatToolDeps, LlmClient, OpenAiLlmClient};
use mc_chat::{AgentConfig, LlmProvider};
use mc_db::AppSettings;
use crate::insights::InsightsService;
use crate::manager::ServerManager;

pub fn build_chat_agent(
    manager: Arc<ServerManager>,
    insights: Arc<InsightsService>,
) -> Arc<dyn ChatAgent> {
    let llm: Arc<dyn LlmClient> = Arc::new(OpenAiLlmClient::new());
    let deps = ChatToolDeps {
        tracker: Arc::clone(&manager) as Arc<dyn mc_chat::TrackerRead>,
        insights: Arc::clone(&insights) as Arc<dyn mc_chat::InsightsRead>,
    };
    Arc::new(AgentLoop::new(llm, ToolRegistry::default_tools(), deps))
}

pub fn agent_config(settings: &AppSettings) -> Result<AgentConfig, String> {
    Ok(AgentConfig {
        llm_base_url: settings.llm_base_url.clone(),
        llm_model: settings.llm_model.clone(),
        max_tool_rounds: settings.llm_max_tool_rounds,
        context_max_turns: settings.llm_context_max_turns,
        tool_max_tokens: settings.llm_tool_max_tokens,
        final_max_tokens: settings.llm_final_max_tokens,
        context_max: settings.llm_context_max,
        context_reserve: settings.llm_context_reserve,
        timeout: Duration::from_secs(settings.llm_timeout_secs),
        provider: LlmProvider::parse(&settings.llm_provider)?,
        parallel_slots: settings.llm_parallel_slots,
        api_key: if settings.llm_api_key.is_empty() {
            None
        } else {
            Some(settings.llm_api_key.clone())
        },
    })
}

pub fn chat_enabled(settings: &AppSettings) -> bool {
    settings.chat_enabled()
}
