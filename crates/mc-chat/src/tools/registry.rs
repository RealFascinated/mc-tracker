use std::sync::Arc;

use crate::error::ChatError;
use crate::traits::ChatTool;

use super::tools_impl::{
    AsnTimeseriesSummaryTool, CompareServersTool, GetAsnTool, GetServerTool, ListAsnsTool,
    ListServersTool, RankServersByAllTimePeakTool, RankServersByGrowthTool, SearchServersTool,
    ServerTimeseriesSummaryTool, TotalTimeseriesSummaryTool,
};

pub struct ToolRegistry {
    pub(crate) tools: Vec<Arc<dyn ChatTool>>,
}

impl ToolRegistry {
    pub fn default_tools() -> Self {
        let tools: Vec<Arc<dyn ChatTool>> = vec![
            Arc::new(ListServersTool),
            Arc::new(SearchServersTool),
            Arc::new(GetServerTool),
            Arc::new(GetAsnTool),
            Arc::new(ServerTimeseriesSummaryTool),
            Arc::new(RankServersByGrowthTool),
            Arc::new(RankServersByAllTimePeakTool),
            Arc::new(TotalTimeseriesSummaryTool),
            Arc::new(ListAsnsTool),
            Arc::new(AsnTimeseriesSummaryTool),
            Arc::new(CompareServersTool),
        ];
        Self { tools }
    }

    pub fn definitions(&self) -> Vec<serde_json::Value> {
        let mut defs: Vec<_> = self.tools.iter().map(|t| t.definition()).collect();
        defs.sort_by(|a, b| {
            a.get("function")
                .and_then(|f| f.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .cmp(
                    b.get("function")
                        .and_then(|f| f.get("name"))
                        .and_then(|n| n.as_str())
                        .unwrap_or(""),
                )
        });
        defs
    }

    pub async fn execute(
        &self,
        name: &str,
        args: serde_json::Value,
        deps: &crate::traits::ChatToolDeps,
    ) -> Result<serde_json::Value, ChatError> {
        let tool = self
            .tools
            .iter()
            .find(|tool| tool.name() == name)
            .ok_or_else(|| ChatError::Tool(format!("unknown tool: {name}")))?;
        tool.execute(deps, args).await
    }

    pub fn clone_registry(&self) -> Self {
        Self {
            tools: self.tools.clone(),
        }
    }
}
