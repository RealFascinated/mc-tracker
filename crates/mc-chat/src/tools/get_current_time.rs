use async_trait::async_trait;
use chrono::Utc;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::helpers::{schema_empty, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct GetCurrentTimeTool;

#[async_trait]
impl ChatTool for GetCurrentTimeTool {
    fn name(&self) -> &'static str {
        "get_current_time"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_current_time",
            "Current UTC date and time. Call before relative time ranges (this month, last 30 days, etc.).",
            schema_empty(),
        )
    }

    async fn execute(
        &self,
        _deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let now = Utc::now();
        Ok(json!({
            "utc": now.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "date": now.format("%Y-%m-%d").to_string(),
            "epoch": now.timestamp(),
        }))
    }
}
