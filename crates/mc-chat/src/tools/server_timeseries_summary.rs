use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_server_timeseries_summary;
use crate::tools::helpers::{require_str, resolve_server_id, schema_server_time_range, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ServerTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for ServerTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_server_timeseries_summary"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_server_timeseries_summary",
            "One-server player trend over a range. 7d+30d overview → get_server_stats.",
            schema_server_time_range(),
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
