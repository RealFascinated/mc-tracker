use async_trait::async_trait;

use crate::error::ChatError;
use crate::tools::compact::compact_asns_growth_rank;
use crate::tools::constants::{DEFAULT_RANK_LIMIT, MAX_RANK_LIMIT};
use crate::tools::helpers::{require_str, schema_time_range_rank, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankAsnsByGrowthTool;

#[async_trait]
impl ChatTool for RankAsnsByGrowthTool {
    fn name(&self) -> &'static str {
        "rank_asns_by_growth"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "rank_asns_by_growth",
            "Rank ASNs by total player count change over a range.",
            schema_time_range_rank(),
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
        let order = match args.get("order").and_then(|v| v.as_str()) {
            Some("losers") => mc_api_types::GrowthRankOrder::Losers,
            _ => mc_api_types::GrowthRankOrder::Gainers,
        };
        let response = deps
            .insights
            .rank_asns_by_growth(from, to, limit, order)
            .await?;
        Ok(compact_asns_growth_rank(response))
    }
}
