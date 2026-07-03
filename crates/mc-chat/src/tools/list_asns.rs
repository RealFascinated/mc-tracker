use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_asns_list;
use crate::tools::constants::LIST_CAP;
use crate::tools::helpers::{tool_def, truncate};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct ListAsnsTool;

#[async_trait]
impl ChatTool for ListAsnsTool {
    fn name(&self) -> &'static str {
        "list_asns"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "list_asns",
            "List hosting ASN networks sorted by players online.",
            json!({
                "type": "object",
                "properties": {}
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_asns().await;
        let truncated = truncate(&mut response.asns, LIST_CAP);
        Ok(compact_asns_list(response, truncated))
    }
}
