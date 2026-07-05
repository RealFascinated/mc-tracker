use mc_api_types::ChatTokenUsage;

use crate::config::AgentConfig;
use crate::llm::types::{ChatCompletionChunk, CompletionUsage};

#[derive(Debug, Clone, Copy, Default)]
pub struct ChunkTimings {
    pub cache_n: u32,
    pub prompt_n: u32,
    pub predicted_n: u32,
}

#[derive(Debug, Clone, Default)]
pub struct TurnUsageAccumulator {
    session_tokens_before_turn: u64,
    peak_prompt_tokens: u32,
    total_completion_tokens: u32,
    total_reasoning_tokens: u32,
    turn_total_tokens: u32,
    cached_tokens: Option<u32>,
    cache_write_tokens: Option<u32>,
}

impl TurnUsageAccumulator {
    pub fn new(session_tokens_before_turn: u64) -> Self {
        Self {
            session_tokens_before_turn,
            ..Default::default()
        }
    }

    pub fn merge_round(&mut self, round: &CompletionUsage) {
        self.peak_prompt_tokens = self.peak_prompt_tokens.max(round.prompt_tokens);
        self.total_completion_tokens = self
            .total_completion_tokens
            .saturating_add(round.completion_tokens);
        self.turn_total_tokens = self.turn_total_tokens.saturating_add(round.total_tokens);
        if let Some(details) = round.completion_tokens_details {
            self.total_reasoning_tokens = self
                .total_reasoning_tokens
                .saturating_add(details.reasoning_tokens);
        }
        if let Some(details) = round.prompt_tokens_details {
            if details.cached_tokens > 0 {
                self.cached_tokens =
                    Some(self.cached_tokens.unwrap_or(0).max(details.cached_tokens));
            }
            if details.cache_write_tokens > 0 {
                self.cache_write_tokens = Some(
                    self.cache_write_tokens
                        .unwrap_or(0)
                        .max(details.cache_write_tokens),
                );
            }
        }
    }

    pub fn merge_chunk(&mut self, chunk: &ChatCompletionChunk) {
        if let Some(usage) = chunk.usage {
            self.merge_round(&usage);
        }
        if let Some(timings) = chunk.timings {
            if self.cached_tokens.is_none() && timings.cache_n > 0 {
                self.cached_tokens = Some(timings.cache_n);
            }
        }
    }

    pub fn turn_total_tokens(&self) -> u32 {
        self.turn_total_tokens
    }

    pub fn peak_prompt_tokens(&self) -> u32 {
        self.peak_prompt_tokens
    }

    pub fn session_total_tokens(&self) -> u64 {
        self.session_tokens_before_turn
            .saturating_add(self.turn_total_tokens as u64)
    }

    pub fn to_chat_token_usage(&self, config: &AgentConfig) -> ChatTokenUsage {
        ChatTokenUsage {
            prompt_tokens: self.peak_prompt_tokens,
            completion_tokens: self.total_completion_tokens,
            context_max: config.context_max,
            turn_total_tokens: self.turn_total_tokens,
            session_total_tokens: self.session_total_tokens(),
            cached_tokens: self.cached_tokens,
            cache_write_tokens: self.cache_write_tokens,
            reasoning_tokens: if self.total_reasoning_tokens > 0 {
                Some(self.total_reasoning_tokens)
            } else {
                None
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::{ChatCompletionChunk, CompletionTokensDetails, PromptTokensDetails};

    #[test]
    fn accumulates_across_rounds() {
        let mut acc = TurnUsageAccumulator::new(1_000);
        acc.merge_round(&CompletionUsage {
            prompt_tokens: 500,
            completion_tokens: 50,
            total_tokens: 550,
            ..Default::default()
        });
        acc.merge_round(&CompletionUsage {
            prompt_tokens: 800,
            completion_tokens: 30,
            total_tokens: 830,
            completion_tokens_details: Some(CompletionTokensDetails {
                reasoning_tokens: 12,
            }),
            prompt_tokens_details: Some(PromptTokensDetails {
                cached_tokens: 400,
                cache_write_tokens: 0,
            }),
        });
        assert_eq!(acc.peak_prompt_tokens(), 800);
        assert_eq!(acc.turn_total_tokens(), 1_380);
        assert_eq!(acc.session_total_tokens(), 2_380);
        let usage = acc.to_chat_token_usage(&AgentConfig {
            llm_base_url: String::new(),
            llm_models: vec![],
            max_tool_rounds: 1,
            context_max_turns: 1,
            tool_max_tokens: 1,
            final_max_tokens: 1,
            context_max: 16_384,
            context_reserve: 0,
            timeout: std::time::Duration::from_secs(1),
            provider: crate::config::LlmProvider::OpenAiCompatible,
            parallel_slots: 0,
            api_key: None,
            www_origin: String::new(),
            thinking_enabled: false,
        });
        assert_eq!(usage.turn_total_tokens, 1_380);
        assert_eq!(usage.completion_tokens, 80);
        assert_eq!(usage.reasoning_tokens, Some(12));
        assert_eq!(usage.session_total_tokens, 2_380);
        assert_eq!(usage.cached_tokens, Some(400));
    }

    #[test]
    fn llama_timings_map_to_cached_tokens() {
        let mut acc = TurnUsageAccumulator::new(0);
        acc.merge_chunk(&ChatCompletionChunk {
            choices: vec![],
            usage: None,
            timings: Some(crate::llm::types::ChatCompletionChunkTimings {
                cache_n: 128,
                prompt_n: 0,
                predicted_n: 0,
            }),
        });
        let usage = acc.to_chat_token_usage(&AgentConfig {
            llm_base_url: String::new(),
            llm_models: vec![],
            max_tool_rounds: 1,
            context_max_turns: 1,
            tool_max_tokens: 1,
            final_max_tokens: 1,
            context_max: 16_384,
            context_reserve: 0,
            timeout: std::time::Duration::from_secs(1),
            provider: crate::config::LlmProvider::LlamaCpp,
            parallel_slots: 0,
            api_key: None,
            www_origin: String::new(),
            thinking_enabled: false,
        });
        assert_eq!(usage.cached_tokens, Some(128));
    }
}
