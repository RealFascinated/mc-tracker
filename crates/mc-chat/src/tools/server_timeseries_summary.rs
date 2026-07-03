use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_server_timeseries_summary;
use crate::tools::helpers::{parse_uuid, require_str, tool_def};
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
            "Player count trend summary for one server, including downsampled points over the range. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string" },
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["server_id", "from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let id = parse_uuid(args.get("server_id"))?;
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps
            .insights
            .server_timeseries_summary(id, from, to)
            .await?;
        Ok(compact_server_timeseries_summary(summary))
    }
}
