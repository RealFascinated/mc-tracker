use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    LlamaCpp,
    OpenRouter,
    OpenAiCompatible,
}

impl LlmProvider {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "llama_cpp" => Ok(Self::LlamaCpp),
            "openrouter" => Ok(Self::OpenRouter),
            "openai_compatible" => Ok(Self::OpenAiCompatible),
            other => Err(format!("unknown llm_provider: {other}")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub llm_base_url: String,
    pub llm_model: String,
    pub max_tool_rounds: u32,
    pub context_max_turns: u32,
    pub tool_max_tokens: u32,
    pub final_max_tokens: u32,
    pub context_max: u32,
    pub context_reserve: u32,
    pub timeout: Duration,
    pub provider: LlmProvider,
    pub parallel_slots: u32,
    pub api_key: Option<String>,
}

impl AgentConfig {
    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref().filter(|key| !key.is_empty())
    }

    pub fn base_url(&self) -> &str {
        self.llm_base_url.trim_end_matches('/')
    }
}
