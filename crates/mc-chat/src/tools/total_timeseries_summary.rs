use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_timeseries_summary;
use crate::tools::helpers::{require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct TotalTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for TotalTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_total_timeseries_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_total_timeseries_summary",
            "Network-wide player count trend summary, including downsampled points over the range. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps.insights.total_timeseries_summary(from, to).await?;
        Ok(compact_timeseries_summary(&summary))
    }
}
