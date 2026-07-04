use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_tracker_summary;
use crate::tools::helpers::{schema_empty, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct GetTrackerSummaryTool;

#[async_trait]
impl ChatTool for GetTrackerSummaryTool {
    fn name(&self) -> &'static str {
        "get_tracker_summary"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_tracker_summary",
            "Network totals now: players online, Java/Bedrock split, server count, peaks. Not list_servers.",
            schema_empty(),
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
