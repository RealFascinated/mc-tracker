use std::pin::Pin;
use std::sync::Arc;

use async_trait::async_trait;
use futures::Stream;
use mc_api_types::{
    AsnDetailResponse, AsnSearchResponse, AsnTimeseriesSummaryResponse, AsnsGrowthRankResponse,
    AsnsListResponse, GrowthRankOrder, IpLookupResponse, ServerListItemResponse,
    ServerTimeseriesSummaryResponse, ServersCompareResponse, ServersGrowthRankResponse,
    ServersListResponse, ServersSearchResponse, ServersSummaryResponse, TimeseriesSummaryResponse,
};
use uuid::Uuid;

use crate::config::{AgentConfig, LlmProvider};
use crate::error::ChatError;
use crate::llm::{
    ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ToolDefinition,
};

pub struct ChatToolDeps {
    pub tracker: Arc<dyn TrackerRead>,
    pub insights: Arc<dyn InsightsRead>,
}

#[async_trait]
pub trait TrackerRead: Send + Sync {
    async fn tracker_summary(&self) -> ServersSummaryResponse;
    async fn list_servers(&self, search: Option<&str>) -> ServersListResponse;
    async fn search_servers(&self, search: Option<&str>, limit: u32) -> ServersSearchResponse;
    async fn server_detail(&self, id: Uuid) -> Option<ServerListItemResponse>;
    async fn asn_detail(&self, asn: &str, asn_org: &str) -> Option<AsnDetailResponse>;
    async fn list_asns(&self, search: Option<&str>) -> AsnsListResponse;
    async fn search_asns(&self, query: &str, limit: u32) -> AsnSearchResponse;
    async fn lookup_ip(&self, query: &str) -> Result<IpLookupResponse, ChatError>;
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

    async fn rank_asns_by_growth(
        &self,
        from: &str,
        to: &str,
        limit: u32,
        order: GrowthRankOrder,
    ) -> Result<AsnsGrowthRankResponse, mc_insights::InsightsError>;

    async fn compare_servers(
        &self,
        ids: &[Uuid],
        from: &str,
        to: &str,
        max_points: usize,
    ) -> Result<ServersCompareResponse, mc_insights::InsightsError>;
}

#[async_trait]
pub trait ChatTool: Send + Sync {
    fn name(&self) -> &'static str;
    fn definition(&self) -> ToolDefinition;
    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError>;
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    fn provider(&self, config: &AgentConfig) -> LlmProvider;

    async fn count_tokens(
        &self,
        config: &AgentConfig,
        model: &str,
        text: &str,
    ) -> Result<u32, ChatError>;

    async fn count_messages_tokens(
        &self,
        config: &AgentConfig,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<u32, ChatError>;

    async fn chat_completion(
        &self,
        config: &AgentConfig,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError>;

    async fn chat_completion_stream(
        &self,
        config: &AgentConfig,
        request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>, ChatError>;
}
