use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct LlmRequestOptions {
    /// OpenRouter sticky routing + llama.cpp slot affinity (hashed from this value).
    pub session_id: Option<String>,
    pub max_tokens: Option<u32>,
    pub parse_tool_calls: bool,
}

impl Default for LlmRequestOptions {
    fn default() -> Self {
        Self {
            session_id: None,
            max_tokens: None,
            parse_tool_calls: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: ToolFunctionSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunctionSchema {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolChoice {
    Auto,
    Required,
}

#[derive(Debug, Clone)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Option<Vec<ToolDefinition>>,
    pub tool_choice: Option<ToolChoice>,
    pub stream: bool,
    pub options: LlmRequestOptions,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize)]
pub struct PromptTokensDetails {
    #[serde(default)]
    pub cached_tokens: u32,
    #[serde(default)]
    pub cache_write_tokens: u32,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize)]
pub struct CompletionUsage {
    #[serde(default)]
    pub prompt_tokens: u32,
    #[serde(default)]
    pub completion_tokens: u32,
    #[serde(default)]
    pub total_tokens: u32,
    #[serde(default)]
    pub prompt_tokens_details: Option<PromptTokensDetails>,
}

impl CompletionUsage {
    pub fn merge_into(&self, acc: &mut CompletionUsage) {
        acc.prompt_tokens = acc.prompt_tokens.max(self.prompt_tokens);
        acc.completion_tokens = acc
            .completion_tokens
            .saturating_add(self.completion_tokens);
        acc.total_tokens = acc.total_tokens.saturating_add(self.total_tokens);
        if let Some(details) = self.prompt_tokens_details {
            let acc_details = acc.prompt_tokens_details.get_or_insert_with(Default::default);
            acc_details.cached_tokens = acc_details.cached_tokens.max(details.cached_tokens);
            acc_details.cache_write_tokens = acc_details
                .cache_write_tokens
                .max(details.cache_write_tokens);
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ChatCompletionChoice>,
    #[serde(default)]
    pub usage: Option<CompletionUsage>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionChoice {
    pub message: ChatMessage,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionChunk {
    #[serde(default)]
    pub choices: Vec<ChatCompletionChunkChoice>,
    #[serde(default)]
    pub usage: Option<CompletionUsage>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatCompletionChunkChoice {
    pub delta: ChatCompletionDelta,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ChatCompletionDelta {
    #[serde(default)]
    pub content: Option<String>,
}
