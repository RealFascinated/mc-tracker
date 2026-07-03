use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_server_timeseries_summary;
use crate::tools::helpers::{resolve_server_id, require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ServerTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for ServerTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_server_timeseries_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_server_timeseries_summary",
            "Player count trend summary for one server over a single range, including downsampled points. For stats/overview with both 7d and 30d, use get_server_stats instead.",
            json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string" },
                    "query": { "type": "string", "description": "Loose search when UUID unknown" },
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
        let id = resolve_server_id(deps, &args).await?;
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps
            .insights
            .server_timeseries_summary(id, from, to)
            .await?;
        Ok(compact_server_timeseries_summary(summary))
    }
}
