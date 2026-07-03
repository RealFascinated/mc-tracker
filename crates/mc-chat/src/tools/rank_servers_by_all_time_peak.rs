use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_all_time_peak;
use crate::tools::helpers::tool_def;
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankServersByAllTimePeakTool;

#[async_trait]
impl ChatTool for RankServersByAllTimePeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_all_time_peak"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_servers_by_all_time_peak",
            "Find which tracked server(s) have the highest all-time player peak. Returns every server tied at the top.",
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
        let response = deps.tracker.list_servers().await;
        Ok(compact_servers_all_time_peak(&response.servers))
    }
}
