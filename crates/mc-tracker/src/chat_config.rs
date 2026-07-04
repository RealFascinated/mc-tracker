use std::sync::Arc;
use std::time::Duration;

use crate::insights::InsightsService;
use crate::manager::ServerManager;
use mc_chat::tools::ToolRegistry;
use mc_chat::{AgentConfig, LlmProvider};
use mc_chat::{AgentLoop, ChatAgent, ChatToolDeps, LlmClient, OpenAiLlmClient};
use mc_settings::{chat_enabled, SettingKey, SettingsStore};

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

pub fn agent_config(store: &SettingsStore) -> Result<AgentConfig, String> {
    let api_key = store.cached_str(SettingKey::LlmApiKey);
    Ok(AgentConfig {
        llm_base_url: store.cached_str(SettingKey::LlmBaseUrl),
        llm_model: store.cached_str(SettingKey::LlmModel),
        max_tool_rounds: store.cached_u32(SettingKey::LlmMaxToolRounds),
        context_max_turns: store.cached_u32(SettingKey::LlmContextMaxTurns),
        tool_max_tokens: store.cached_u32(SettingKey::LlmToolMaxTokens),
        final_max_tokens: store.cached_u32(SettingKey::LlmFinalMaxTokens),
        context_max: store.cached_u32(SettingKey::LlmContextMax),
        context_reserve: store.cached_u32(SettingKey::LlmContextReserve),
        timeout: Duration::from_secs(store.cached_u64(SettingKey::LlmTimeoutSecs)),
        provider: LlmProvider::parse(&store.cached_str(SettingKey::LlmProvider))?,
        parallel_slots: store.cached_u32(SettingKey::LlmParallelSlots),
        api_key: if api_key.is_empty() {
            None
        } else {
            Some(api_key)
        },
    })
}

pub fn chat_enabled_for(store: &SettingsStore) -> bool {
    chat_enabled(&store.cached_str(SettingKey::LlmBaseUrl))
}
