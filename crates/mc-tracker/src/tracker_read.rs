use async_trait::async_trait;
use mc_chat::TrackerRead;
use uuid::Uuid;

use crate::manager::ServerManager;

#[async_trait]
impl TrackerRead for ServerManager {
    async fn list_servers(&self) -> mc_api_types::ServersListResponse {
        self.servers_list_response(None).await
    }

    async fn search_servers(
        &self,
        search: Option<&str>,
        limit: u32,
    ) -> mc_api_types::ServersSearchResponse {
        self.servers_search_response(search, limit).await
    }

    async fn server_detail(&self, id: Uuid) -> Option<mc_api_types::ServerListItemResponse> {
        self.server_detail_response(id).await
    }

    async fn asn_detail(
        &self,
        asn: &str,
        asn_org: &str,
    ) -> Option<mc_api_types::AsnDetailResponse> {
        self.asn_detail_response(asn, asn_org).await
    }

    async fn list_asns(&self) -> mc_api_types::AsnsListResponse {
        self.asns_list_response(None).await
    }

    async fn search_asns(&self, query: &str, limit: u32) -> mc_api_types::AsnSearchResponse {
        self.search_asns_response(query, limit).await
    }
}
