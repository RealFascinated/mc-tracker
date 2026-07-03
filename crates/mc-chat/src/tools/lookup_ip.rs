use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_ip_lookup;
use crate::tools::helpers::{require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct LookupIpTool;

#[async_trait]
impl ChatTool for LookupIpTool {
    fn name(&self) -> &'static str {
        "lookup_ip"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "lookup_ip",
            "Resolve an IP address or hostname and look up its ASN/hosting network via MaxMind. Use when the user asks about a specific IP — not tracked server names (get_server) or ASN labels (get_asn).",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "IPv4/IPv6 address or hostname" }
                },
                "required": ["query"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let query = require_str(&args, "query")?.trim();
        if query.is_empty() {
            return Err(ChatError::Tool("query must not be empty".into()));
        }
        let response = deps.tracker.lookup_ip(query).await?;
        Ok(compact_ip_lookup(response))
    }
}
