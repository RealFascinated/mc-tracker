use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_list;
use crate::tools::constants::LIST_CAP;
use crate::tools::helpers::{tool_def, truncate};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ListServersTool;

#[async_trait]
impl ChatTool for ListServersTool {
    fn name(&self) -> &'static str {
        "list_servers"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "list_servers",
            "List tracked servers sorted by players online.",
            json!({
                "type": "object",
                "properties": {}
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_servers().await;
        let truncated = truncate(&mut response.servers, LIST_CAP);
        Ok(compact_servers_list(response, truncated))
    }
}
