use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_compare_servers;
use crate::tools::constants::MAX_COMPARE_SERVERS;
use crate::tools::helpers::{
    compare_peer_ids, parse_uuid, require_str, resolve_server_id, tool_def,
};
use crate::traits::{ChatTool, ChatToolDeps};
use mc_insights::DEFAULT_MAX_SUMMARY_POINTS;

pub struct CompareServersTool;

#[async_trait]
impl ChatTool for CompareServersTool {
    fn name(&self) -> &'static str {
        "compare_servers"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "compare_servers",
            "Compare 2–5 server trends. server_ids, or base server + peer_count.",
            json!({
                "type": "object",
                "properties": {
                    "server_ids": {
                        "type": "array",
                        "items": { "type": "string" }
                    },
                    "server_id": { "type": "string" },
                    "query": { "type": "string" },
                    "peer_count": { "type": "integer" },
                    "from": { "type": "string" },
                    "to": { "type": "string" }
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
            let list = deps.tracker.list_servers(None).await;
            compare_peer_ids(base_id, &list.servers, peer_count)
        };

        if ids.len() < 2 {
            return Err(ChatError::Tool("need at least 2 servers to compare".into()));
        }

        let response = deps
            .insights
            .compare_servers(&ids, from, to, DEFAULT_MAX_SUMMARY_POINTS)
            .await?;
        Ok(compact_compare_servers(response))
    }
}
