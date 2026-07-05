use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_asns_list;
use crate::tools::constants::LIST_CAP;
use crate::tools::helpers::{
    optional_search, schema_optional_search_limit, tool_def, truncate,
};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ListAsnsTool;

#[async_trait]
impl ChatTool for ListAsnsTool {
    fn name(&self) -> &'static str {
        "list_asns"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "list_asns",
            "List ASNs by players online; optional search and limit (default 25, max 25).",
            schema_optional_search_limit(),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_asns(optional_search(&args)).await;
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(LIST_CAP as u64) as usize;
        let limit = limit.clamp(1, LIST_CAP);
        let truncated = truncate(&mut response.asns, limit);
        Ok(compact_asns_list(response, truncated))
    }
}
