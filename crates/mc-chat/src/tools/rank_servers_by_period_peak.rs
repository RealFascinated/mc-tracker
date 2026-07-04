use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_period_peak_rank;
use crate::tools::constants::{DEFAULT_RANK_LIMIT, MAX_RANK_LIMIT};
use crate::tools::helpers::{require_str, schema_time_range_limit, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankServersByPeriodPeakTool;

#[async_trait]
impl ChatTool for RankServersByPeriodPeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_period_peak"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "rank_servers_by_period_peak",
            "Rank servers by peak players reached during a range.",
            schema_time_range_limit(),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(DEFAULT_RANK_LIMIT as u64) as u32;
        let limit = limit.clamp(1, MAX_RANK_LIMIT);
        let response = deps
            .insights
            .rank_servers_by_period_peak(from, to, limit)
            .await?;
        Ok(compact_servers_period_peak_rank(response))
    }
}
