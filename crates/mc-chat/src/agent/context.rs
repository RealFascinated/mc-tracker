use crate::config::AgentConfig;
use crate::llm::types::{ChatMessage, MessageRole};
use crate::prompt::system_prompt;
use crate::types::AgentChatRequest;

pub struct ContextBuilder;

const USAGE_TRIM_THRESHOLD_PCT: u32 = 85;

impl ContextBuilder {
    pub fn build_prompt_messages(
        config: &AgentConfig,
        request: &AgentChatRequest,
    ) -> (Vec<ChatMessage>, bool) {
        let mut messages = vec![ChatMessage {
            role: MessageRole::System,
            content: Some(system_prompt()),
            tool_calls: None,
            tool_call_id: None,
        }];

        let mut history_messages: Vec<ChatMessage> = request.history.clone();
        let mut truncated =
            truncate_turn_pairs(&mut history_messages, config.context_max_turns as usize);

        if should_trim_from_last_usage(config, request.last_turn_prompt_tokens)
            && truncate_one_turn_pair(&mut history_messages)
        {
            truncated = true;
        }

        messages.extend(history_messages);
        messages.push(ChatMessage {
            role: MessageRole::User,
            content: Some(user_message_content(request)),
            tool_calls: None,
            tool_call_id: None,
        });

        (messages, truncated)
    }
}

fn should_trim_from_last_usage(config: &AgentConfig, last_turn_prompt_tokens: Option<u32>) -> bool {
    let Some(prompt_tokens) = last_turn_prompt_tokens else {
        return false;
    };
    if config.context_max == 0 {
        return false;
    }
    let threshold = config
        .context_max
        .saturating_mul(USAGE_TRIM_THRESHOLD_PCT)
        .saturating_div(100);
    prompt_tokens >= threshold
}

fn user_message_content(request: &AgentChatRequest) -> String {
    let Some(ctx) = &request.context_server else {
        return request.message.clone();
    };
    format!(
        "[Viewing server: {} ({}). Use this server_id for get_server or compare_servers — do not call list_servers or search_servers for this server.]\n\n{}",
        ctx.server_name, ctx.server_id, request.message
    )
}

fn truncate_turn_pairs(messages: &mut Vec<ChatMessage>, max_pairs: usize) -> bool {
    let mut truncated = false;
    loop {
        let user_indices: Vec<usize> = messages
            .iter()
            .enumerate()
            .filter(|(_, m)| m.role == MessageRole::User)
            .map(|(i, _)| i)
            .collect();
        if user_indices.len() <= max_pairs {
            break;
        }
        if !truncate_one_turn_pair(messages) {
            break;
        }
        truncated = true;
    }
    truncated
}

fn truncate_one_turn_pair(messages: &mut Vec<ChatMessage>) -> bool {
    let user_indices: Vec<usize> = messages
        .iter()
        .enumerate()
        .filter(|(_, m)| m.role == MessageRole::User)
        .map(|(i, _)| i)
        .collect();
    if user_indices.is_empty() {
        return false;
    }
    let drop_from = user_indices[0];
    let drop_to = user_indices.get(1).copied().unwrap_or(messages.len());
    messages.drain(drop_from..drop_to);
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::ChatMessage;

    #[test]
    fn truncate_turn_pairs_drops_oldest() {
        let mut messages = vec![
            ChatMessage {
                role: MessageRole::User,
                content: Some("a".into()),
                tool_calls: None,
                tool_call_id: None,
            },
            ChatMessage {
                role: MessageRole::Assistant,
                content: Some("b".into()),
                tool_calls: None,
                tool_call_id: None,
            },
            ChatMessage {
                role: MessageRole::User,
                content: Some("c".into()),
                tool_calls: None,
                tool_call_id: None,
            },
        ];
        assert!(truncate_turn_pairs(&mut messages, 1));
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content.as_deref(), Some("c"));
    }

    #[test]
    fn usage_trim_when_last_prompt_near_limit() {
        let config = AgentConfig {
            llm_base_url: String::new(),
            llm_models: vec![],
            max_tool_rounds: 1,
            context_max_turns: 10,
            tool_max_tokens: 1,
            final_max_tokens: 1,
            context_max: 1_000,
            context_reserve: 0,
            timeout: std::time::Duration::from_secs(1),
            provider: crate::config::LlmProvider::OpenAiCompatible,
            parallel_slots: 0,
            api_key: None,
            www_origin: String::new(),
            thinking_enabled: false,
        };
        assert!(should_trim_from_last_usage(&config, Some(900)));
        assert!(!should_trim_from_last_usage(&config, Some(100)));
    }
}
