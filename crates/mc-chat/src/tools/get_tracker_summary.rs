use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_tracker_summary;
use crate::tools::helpers::tool_def;
use crate::traits::{ChatTool, ChatToolDeps};

pub struct GetTrackerSummaryTool;

#[async_trait]
impl ChatTool for GetTrackerSummaryTool {
    fn name(&self) -> &'static str {
        "get_tracker_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_tracker_summary",
            "Current network snapshot: total players online, Java/Bedrock split, tracked server count, and network peaks. Use for how many players are tracked right now — not list_servers.",
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
        let summary = deps.tracker.tracker_summary().await;
        Ok(compact_tracker_summary(&summary))
    }
}
