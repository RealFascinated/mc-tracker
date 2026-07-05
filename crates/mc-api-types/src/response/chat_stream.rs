use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub context_max: u32,
    pub turn_total_tokens: u32,
    pub session_total_tokens: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_write_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatToolCallRecord {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatStreamEvent {
    ToolStart {
        name: String,
    },
    ToolDone {
        name: String,
    },
    Delta {
        content: String,
    },
    ReasoningDelta {
        content: String,
    },
    Usage {
        usage: ChatTokenUsage,
    },
    Done {
        #[serde(rename = "toolCalls")]
        tool_calls: Vec<ChatToolCallRecord>,
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<ChatTokenUsage>,
        #[serde(default)]
        truncated: bool,
        #[serde(skip_serializing_if = "Option::is_none", rename = "finishReason")]
        finish_reason: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none", rename = "quotaUsed")]
        quota_used: Option<u32>,
    },
    Error {
        message: String,
    },
}
