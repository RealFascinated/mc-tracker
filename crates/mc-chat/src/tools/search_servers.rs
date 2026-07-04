use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_search;
use crate::tools::helpers::{require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct SearchServersTool;

#[async_trait]
impl ChatTool for SearchServersTool {
    fn name(&self) -> &'static str {
        "search_servers"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "search_servers",
            "Keyword server discovery when name is unknown. Named servers → get_server.",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "limit": { "type": "integer" }
                },
                "required": ["query"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let query = require_str(&args, "query")?;
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as u32;
        let response = deps.tracker.search_servers(Some(query), limit).await;
        Ok(compact_search(response))
    }
}
