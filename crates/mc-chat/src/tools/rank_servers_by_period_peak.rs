use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_period_peak_rank;
use crate::tools::constants::{DEFAULT_RANK_LIMIT, MAX_RANK_LIMIT};
use crate::tools::helpers::{require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankServersByPeriodPeakTool;

#[async_trait]
impl ChatTool for RankServersByPeriodPeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_period_peak"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_servers_by_period_peak",
            "Rank tracked servers by highest player count reached during a time range. Use for which server had the most players this week/month — one call, not per-server summaries.",
            json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Start bound, e.g. 30d or 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" },
                    "limit": {
                        "type": "integer",
                        "description": "Max servers to return (default 10)"
                    }
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
