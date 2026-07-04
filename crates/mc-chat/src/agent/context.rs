use crate::config::AgentConfig;
use crate::llm::types::{ChatMessage, MessageRole};
use crate::prompt::system_prompt;
use crate::traits::LlmClient;
use crate::types::AgentChatRequest;

pub struct ContextBuilder;

impl ContextBuilder {
    pub async fn build_prompt_messages(
        llm: &dyn LlmClient,
        config: &AgentConfig,
        history: &[ChatMessage],
        request: &AgentChatRequest,
    ) -> (Vec<ChatMessage>, bool) {
        let mut messages = vec![ChatMessage {
            role: MessageRole::System,
            content: Some(system_prompt()),
            tool_calls: None,
            tool_call_id: None,
        }];

        let mut history_messages: Vec<ChatMessage> = history.to_vec();
        truncate_turn_pairs(&mut history_messages, config.context_max_turns as usize);

        messages.extend(history_messages);
        messages.push(ChatMessage {
            role: MessageRole::User,
            content: Some(user_message_content(request)),
            tool_calls: None,
            tool_call_id: None,
        });

        let truncated = truncate_to_token_budget(llm, config, &mut messages).await;
        (messages, truncated)
    }
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

fn truncate_turn_pairs(messages: &mut Vec<ChatMessage>, max_pairs: usize) {
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
        let drop_from = user_indices[0];
        let drop_to = user_indices.get(1).copied().unwrap_or(messages.len());
        messages.drain(drop_from..drop_to);
    }
}

async fn truncate_to_token_budget(
    llm: &dyn LlmClient,
    config: &AgentConfig,
    messages: &mut Vec<ChatMessage>,
) -> bool {
    let model = config.llm_model.as_str();
    let budget = config.context_max.saturating_sub(config.context_reserve);
    let mut truncated = false;

    loop {
        let count = llm
            .count_messages_tokens(config, model, messages)
            .await
            .unwrap_or_else(|_| estimate_messages_tokens(messages));
        if count <= budget {
            break;
        }
        let user_indices: Vec<usize> = messages
            .iter()
            .enumerate()
            .skip(1)
            .filter(|(_, m)| m.role == MessageRole::User)
            .map(|(i, _)| i)
            .collect();
        if user_indices.is_empty() {
            break;
        }
        let drop_from = user_indices[0];
        let drop_to = user_indices.get(1).copied().unwrap_or(messages.len());
        messages.drain(drop_from..drop_to);
        truncated = true;
        tracing::info!(prompt_tokens = count, budget, "context_truncated_turns");
    }
    truncated
}

fn estimate_messages_tokens(messages: &[ChatMessage]) -> u32 {
    messages
        .iter()
        .map(|m| {
            let mut len = m.role.as_str().len();
            if let Some(content) = &m.content {
                len += content.len();
            }
            (len / 3).max(1) as u32
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

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
        truncate_turn_pairs(&mut messages, 1);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content.as_deref(), Some("c"));
    }
}
