use std::pin::Pin;
use std::sync::Arc;

use async_trait::async_trait;
use futures::Stream;
use mc_api_types::{
    AsnDetailResponse, AsnSearchResponse, AsnsListResponse, IpLookupResponse,
    ServerListItemResponse, ServersListResponse, ServersSearchResponse, ServersSummaryResponse,
};
use mc_insights::InsightsChat;

use crate::config::{AgentConfig, LlmProvider};
use crate::error::ChatError;
use crate::llm::{
    ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, ToolDefinition,
};

pub struct ChatToolDeps {
    pub tracker: Arc<dyn TrackerRead>,
    pub insights: Arc<InsightsChat>,
}

#[async_trait]
pub trait TrackerRead: Send + Sync {
    async fn tracker_summary(&self) -> ServersSummaryResponse;
    async fn list_servers(&self, search: Option<&str>) -> ServersListResponse;
    async fn search_servers(&self, search: Option<&str>, limit: u32) -> ServersSearchResponse;
    async fn server_detail(&self, id: uuid::Uuid) -> Option<ServerListItemResponse>;
    async fn asn_detail(&self, asn: &str, asn_org: &str) -> Option<AsnDetailResponse>;
    async fn list_asns(&self, search: Option<&str>) -> AsnsListResponse;
    async fn search_asns(&self, query: &str, limit: u32) -> AsnSearchResponse;
    async fn lookup_ip(&self, query: &str) -> Result<IpLookupResponse, ChatError>;
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
