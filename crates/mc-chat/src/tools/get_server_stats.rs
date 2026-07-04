use async_trait::async_trait;
use futures::future::join_all;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_server_stats;
use crate::tools::helpers::{resolve_server_id, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

const DEFAULT_PERIODS: &[&str] = &["7d", "30d"];

pub struct GetServerStatsTool;

#[async_trait]
impl ChatTool for GetServerStatsTool {
    fn name(&self) -> &'static str {
        "get_server_stats"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_server_stats",
            "Server snapshot plus player-count trends for 7d and 30d (to now) in one call. Use for stats about / tell me about / overview of a server — not get_server + separate timeseries calls.",
            json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string", "description": "Server UUID" },
                    "query": { "type": "string", "description": "Loose search when UUID unknown" }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let id = resolve_server_id(deps, &args).await?;
        let server = deps
            .tracker
            .server_detail(id)
            .await
            .ok_or_else(|| ChatError::Tool("server not found".into()))?;

        let futures: Vec<_> = DEFAULT_PERIODS
            .iter()
            .map(|period| deps.insights.server_timeseries_summary(id, period, "now"))
            .collect();
        let results = join_all(futures).await;

        let trends: Vec<_> = DEFAULT_PERIODS
            .iter()
            .zip(results)
            .map(|(label, result)| {
                (
                    *label,
                    result
                        .map(|summary| summary.summary)
                        .map_err(|err| err.to_string()),
                )
            })
            .collect();

        Ok(compact_server_stats(&server, &trends))
    }
}
