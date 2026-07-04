use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_asn_timeseries_summary;
use crate::tools::helpers::{require_str, resolve_asn, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct AsnTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for AsnTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_asn_timeseries_summary"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_asn_timeseries_summary",
            "Player count trend summary for a hosting ASN network, including downsampled points. Use asn+asn_org from get_asn, or query for a loose lookup. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "asn": { "type": "string" },
                    "asn_org": { "type": "string" },
                    "query": { "type": "string", "description": "Loose ASN/asnOrg search when asn unknown" },
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
        let (asn, asn_org) = resolve_asn(deps, &args).await?;
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps
            .insights
            .asn_timeseries_summary(&asn, &asn_org, from, to)
            .await?;
        Ok(compact_asn_timeseries_summary(summary))
    }
}
