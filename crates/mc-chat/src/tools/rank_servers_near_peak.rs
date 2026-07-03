use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_servers_near_peak;
use crate::tools::constants::{
    DEFAULT_NEAR_PEAK_LIMIT, DEFAULT_NEAR_PEAK_MIN_UTILIZATION, LIST_CAP,
};
use crate::tools::helpers::tool_def;
use crate::traits::{ChatTool, ChatToolDeps};

pub struct RankServersNearPeakTool;

#[async_trait]
impl ChatTool for RankServersNearPeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_near_peak"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_servers_near_peak",
            "Find servers currently near their recent peak player count. Ranks by utilization (players online vs 24h peak, falling back to all-time peak).",
            json!({
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Max servers to return (default 10)"
                    },
                    "min_utilization_pct": {
                        "type": "number",
                        "description": "Minimum utilization percent vs reference peak (default 90)"
                    }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(DEFAULT_NEAR_PEAK_LIMIT as u64) as usize;
        let limit = limit.clamp(1, LIST_CAP);
        let min_utilization_pct = args
            .get("min_utilization_pct")
            .and_then(|v| v.as_f64())
            .unwrap_or(DEFAULT_NEAR_PEAK_MIN_UTILIZATION)
            .clamp(1.0, 100.0);
        let response = deps.tracker.list_servers(None).await;
        Ok(compact_servers_near_peak(
            &response.servers,
            limit,
            min_utilization_pct,
        ))
    }
}
