use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_asns_list;
use crate::tools::constants::LIST_CAP;
use crate::tools::helpers::{optional_search, tool_def, truncate};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ListAsnsTool;

#[async_trait]
impl ChatTool for ListAsnsTool {
    fn name(&self) -> &'static str {
        "list_asns"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "list_asns",
            "List hosting ASN networks sorted by players online. Optional search filters by asn number or asnOrg label.",
            json!({
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": "Filter by ASN number or asnOrg label substring"
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
        let mut response = deps.tracker.list_asns(optional_search(&args)).await;
        let truncated = truncate(&mut response.asns, LIST_CAP);
        Ok(compact_asns_list(response, truncated))
    }
}
