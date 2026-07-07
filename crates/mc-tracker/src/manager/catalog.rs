use async_trait::async_trait;
use mc_insights::{ServerCatalog, ServerMeta};
use uuid::Uuid;

use super::ServerManager;

#[async_trait]
impl ServerCatalog for ServerManager {
    fn environment(&self) -> &str {
        self.environment()
    }

    async fn server_is_tracked(&self, id: Uuid) -> bool {
        self.get_tracked(id)
            .await
            .is_some_and(|server| server.is_tracking())
    }

    async fn server_detail(&self, id: Uuid) -> Option<ServerMeta> {
        let server = self.get_tracked(id).await?;
        if !server.is_tracking() {
            return None;
        }
        Some(ServerMeta {
            id: server.config.id,
            name: server.config.name.clone(),
        })
    }

    async fn list_server_ids(&self) -> Vec<Uuid> {
        self.servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
            .map(|server| server.config.id)
            .collect()
    }

    async fn asn_is_tracked(&self, asn: &str, asn_org: &str) -> bool {
        self.servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
            .any(|server| server.asn.asn == asn && server.asn.asn_org == asn_org)
    }

    async fn list_asn_keys(&self) -> Vec<(String, String)> {
        self.servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
            .map(|server| (server.asn.asn.clone(), server.asn.asn_org.clone()))
            .collect()
    }
}

impl ServerManager {
    pub(crate) async fn refresh_vm_clients(&self, store: &mc_settings::SettingsStore) {
        let url = store.cached_str(mc_settings::SettingKey::VictoriametricsUrl);
        self.insights
            .refresh(
                mc_settings::victoriametrics_base_url(&url),
                mc_settings::victoriametrics_import_url(&url),
                self.vm_auth_token.clone(),
            )
            .await;
    }
}
