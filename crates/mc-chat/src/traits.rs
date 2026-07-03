use std::pin::Pin;
use std::sync::Arc;

use async_trait::async_trait;
use futures::Stream;
use mc_api_types::{
    AsnDetailResponse, AsnSearchResponse, AsnTimeseriesSummaryResponse, AsnsListResponse,
    GrowthRankOrder, ServerListItemResponse, ServerTimeseriesSummaryResponse,
    ServersGrowthRankResponse, ServersListResponse, ServersSearchResponse,
    TimeseriesSummaryResponse,
};
use uuid::Uuid;

use crate::error::ChatError;
use crate::llm::{ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse};

pub struct ChatToolDeps {
    pub tracker: Arc<dyn TrackerRead>,
    pub insights: Arc<dyn InsightsRead>,
}

#[async_trait]
pub trait TrackerRead: Send + Sync {
    async fn list_servers(&self) -> ServersListResponse;
    async fn search_servers(&self, search: Option<&str>, limit: u32) -> ServersSearchResponse;
    async fn server_detail(&self, id: Uuid) -> Option<ServerListItemResponse>;
    async fn asn_detail(&self, asn: &str, asn_org: &str) -> Option<AsnDetailResponse>;
    async fn list_asns(&self) -> AsnsListResponse;
    async fn search_asns(&self, query: &str, limit: u32) -> AsnSearchResponse;
}

#[async_trait]
pub trait InsightsRead: Send + Sync {
    async fn server_timeseries_summary(
        &self,
        id: Uuid,
        from: &str,
        to: &str,
    ) -> Result<ServerTimeseriesSummaryResponse, mc_insights::InsightsError>;

    async fn total_timeseries_summary(
        &self,
        from: &str,
        to: &str,
    ) -> Result<TimeseriesSummaryResponse, mc_insights::InsightsError>;

    async fn asn_timeseries_summary(
        &self,
        asn: &str,
        asn_org: &str,
        from: &str,
        to: &str,
    ) -> Result<AsnTimeseriesSummaryResponse, mc_insights::InsightsError>;

    async fn rank_servers_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<ServersGrowthRankResponse, mc_insights::InsightsError>;

    async fn rank_servers_by_period_peak(
        &self,
        from: &str,
        to: &str,
        limit: u32,
    ) -> Result<mc_api_types::ServersPeriodPeakRankResponse, mc_insights::InsightsError>;
}

#[async_trait]
pub trait ChatTool: Send + Sync {
    fn name(&self) -> &'static str;
    fn definition(&self) -> serde_json::Value;
    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError>;
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError>;

    async fn chat_completion_stream(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>, ChatError>;
}
