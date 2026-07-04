use async_trait::async_trait;
use serde_json::json;

use crate::error::ChatError;
use crate::tools::compact::compact_server;
use crate::tools::helpers::{resolve_server_id, tool_def};
use crate::traits::{ChatTool, ChatToolDeps};

pub struct GetServerTool;

#[async_trait]
impl ChatTool for GetServerTool {
    fn name(&self) -> &'static str {
        "get_server"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "get_server",
            "Get one server by UUID or name/query. Use for tell me about / what is questions and any single-server question.",
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
        Ok(compact_server(&server))
    }
}
