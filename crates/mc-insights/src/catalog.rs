use async_trait::async_trait;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ServerMeta {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct AsnPeakKey {
    pub asn: String,
    pub asn_org: String,
}

#[async_trait]
pub trait ServerCatalog: Send + Sync {
    fn environment(&self) -> &str;

    async fn server_is_tracked(&self, id: Uuid) -> bool;

    async fn server_detail(&self, id: Uuid) -> Option<ServerMeta>;

    async fn list_server_ids(&self) -> Vec<Uuid>;

    async fn asn_is_tracked(&self, asn: &str, asn_org: &str) -> bool;

    async fn list_asn_keys(&self) -> Vec<(String, String)>;
}
