use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatTokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub context_max: u32,
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
    Done {
        #[serde(default)]
        tool_calls: Vec<ChatToolCallRecord>,
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<ChatTokenUsage>,
        #[serde(skip_serializing_if = "Option::is_none")]
        raw_history: Option<Vec<serde_json::Value>>,
    },
    Error {
        message: String,
    },
}
