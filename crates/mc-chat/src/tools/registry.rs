use std::sync::Arc;

use crate::error::ChatError;
use crate::traits::ChatTool;

use super::asn_timeseries_summary::AsnTimeseriesSummaryTool;
use super::compare_servers::CompareServersTool;
use super::get_asn::GetAsnTool;
use super::get_server::GetServerTool;
use super::list_asns::ListAsnsTool;
use super::list_servers::ListServersTool;
use super::lookup_ip::LookupIpTool;
use super::rank_servers_by_all_time_peak::RankServersByAllTimePeakTool;
use super::rank_servers_by_growth::RankServersByGrowthTool;
use super::rank_servers_by_period_peak::RankServersByPeriodPeakTool;
use super::rank_servers_near_peak::RankServersNearPeakTool;
use super::search_servers::SearchServersTool;
use super::server_timeseries_summary::ServerTimeseriesSummaryTool;
use super::total_timeseries_summary::TotalTimeseriesSummaryTool;

#[derive(Clone)]
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
            Arc::new(LookupIpTool),
            Arc::new(ServerTimeseriesSummaryTool),
            Arc::new(RankServersByGrowthTool),
            Arc::new(RankServersByAllTimePeakTool),
            Arc::new(RankServersNearPeakTool),
            Arc::new(RankServersByPeriodPeakTool),
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
}
