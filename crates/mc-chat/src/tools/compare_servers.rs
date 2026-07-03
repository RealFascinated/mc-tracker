use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_compare_servers;
use crate::tools::constants::MAX_COMPARE_SERVERS;
use crate::tools::helpers::{
    compare_peer_ids, parse_uuid, require_str, resolve_server_id, tool_def,
};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct CompareServersTool;

#[async_trait]
impl ChatTool for CompareServersTool {
    fn name(&self) -> &'static str {
        "compare_servers"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "compare_servers",
            "Compare player count trends for 2–5 servers; each result includes downsampled points. Pass server_ids for a specific set, or server_id/query + peer_count to compare one server against the current top peers.",
            json!({
                "type": "object",
                "properties": {
                    "server_ids": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Specific server UUIDs to compare (2–5)"
                    },
                    "server_id": { "type": "string", "description": "Base server UUID" },
                    "query": { "type": "string", "description": "Base server name when UUID unknown" },
                    "peer_count": {
                        "type": "integer",
                        "description": "With server_id/query: how many top servers to compare against (default 4)"
                    },
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

        let ids = if let Some(ids_raw) = args.get("server_ids").and_then(|v| v.as_array()) {
            ids_raw
                .iter()
                .take(MAX_COMPARE_SERVERS)
                .map(|v| parse_uuid(Some(v)))
                .collect::<Result<Vec<_>, _>>()?
        } else {
            let base_id = resolve_server_id(deps, &args).await?;
            let peer_count = args.get("peer_count").and_then(|v| v.as_u64()).unwrap_or(4) as usize;
            let list = deps.tracker.list_servers().await;
            compare_peer_ids(base_id, &list.servers, peer_count)
        };

        if ids.len() < 2 {
            return Err(ChatError::Tool("need at least 2 servers to compare".into()));
        }

        let mut rows = Vec::with_capacity(ids.len());
        let mut errors = Vec::new();
        for id in ids {
            match deps.insights.server_timeseries_summary(id, from, to).await {
                Ok(summary) => {
                    rows.push((summary.id.clone(), summary.name.clone(), summary.summary))
                }
                Err(err) => errors.push((id.to_string(), err.to_string())),
            }
        }

        Ok(compact_compare_servers(rows, errors))
    }
}
