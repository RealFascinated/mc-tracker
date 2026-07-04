use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_asn_detail;
use crate::tools::helpers::{compact_asn_query, require_str, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct GetAsnTool;

#[async_trait]
impl ChatTool for GetAsnTool {
    fn name(&self) -> &'static str {
        "get_asn"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_asn",
            "Hosting ASN lookup by asn/asn_org or query. Not for server names.",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "asn": { "type": "string" },
                    "asn_org": { "type": "string" }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        if let Some(query) = args.get("query").and_then(|v| v.as_str()) {
            let query = query.trim();
            if query.is_empty() {
                return Err(ChatError::Tool("query must not be empty".into()));
            }
            return compact_asn_query(deps, query).await;
        }

        let asn = require_str(&args, "asn")?;
        let asn_org = args.get("asn_org").and_then(|v| v.as_str()).unwrap_or("");
        let detail = deps
            .tracker
            .asn_detail(asn, asn_org)
            .await
            .ok_or_else(|| ChatError::Tool("asn not found".into()))?;
        Ok(compact_asn_detail(detail))
    }
}
