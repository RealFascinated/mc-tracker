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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThinkingEffort {
    Low,
    Medium,
    High,
}

impl ThinkingEffort {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            other => Err(format!("unknown llm_thinking_effort: {other}")),
        }
    }

    pub fn as_api_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }

    pub fn llama_thinking_budget_tokens(self) -> i32 {
        match self {
            Self::Low => 1024,
            Self::Medium => 4096,
            Self::High => 16384,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub llm_base_url: String,
    pub llm_models: Vec<String>,
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
    pub www_origin: String,
    pub thinking_enabled: bool,
    pub thinking_effort: ThinkingEffort,
}

impl AgentConfig {
    pub fn api_key(&self) -> Option<&str> {
        self.api_key.as_deref().filter(|key| !key.is_empty())
    }

    pub fn base_url(&self) -> &str {
        self.llm_base_url.trim_end_matches('/')
    }

    pub fn primary_model(&self) -> &str {
        self.llm_models
            .first()
            .map(String::as_str)
            .filter(|model| !model.is_empty())
            .unwrap_or("default")
    }
}
