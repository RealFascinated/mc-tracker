use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_list;
use crate::tools::constants::LIST_CAP;
use crate::tools::helpers::{optional_search, tool_def, truncate};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ListServersTool;

#[async_trait]
impl ChatTool for ListServersTool {
    fn name(&self) -> &'static str {
        "list_servers"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "list_servers",
            "List tracked servers sorted by players online. Optional search filters by name or host.",
            json!({
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": "Filter by server name or host substring"
                    }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_servers(optional_search(&args)).await;
        let truncated = truncate(&mut response.servers, LIST_CAP);
        Ok(compact_servers_list(response, truncated))
    }
}
