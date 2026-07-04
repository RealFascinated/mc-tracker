use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_all_time_peak;
use crate::tools::helpers::{schema_empty, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankServersByAllTimePeakTool;

#[async_trait]
impl ChatTool for RankServersByAllTimePeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_all_time_peak"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "rank_servers_by_all_time_peak",
            "Servers with the highest all-time player peak (includes ties).",
            schema_empty(),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let response = deps.tracker.list_servers(None).await;
        Ok(compact_servers_all_time_peak(&response.servers))
    }
}
