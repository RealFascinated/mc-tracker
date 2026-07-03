use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_asns_growth_rank;
use crate::tools::constants::{DEFAULT_RANK_LIMIT, MAX_RANK_LIMIT};
use crate::tools::helpers::{require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankAsnsByGrowthTool;

#[async_trait]
impl ChatTool for RankAsnsByGrowthTool {
    fn name(&self) -> &'static str {
        "rank_asns_by_growth"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_asns_by_growth",
            "Rank hosting ASN networks by total player count change over a time range. Use for which provider grew or declined the most — one call, not per-network summaries.",
            json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Start bound, e.g. 30d or 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" },
                    "limit": {
                        "type": "integer",
                        "description": "Max networks to return (default 10)"
                    },
                    "order": {
                        "type": "string",
                        "enum": ["gainers", "losers"],
                        "description": "Rank by highest growth (gainers) or largest decline (losers). Default gainers."
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
