use std::collections::BTreeMap;

use mc_api_types::{
    AsnTimeseriesResponse, ServerTimeseriesResponse, ServersCompareTimeseriesResponse,
};
use tokio::sync::RwLock;
use tracing::warn;
use uuid::Uuid;

use crate::catalog::{AsnPeakKey, ServerCatalog};
use crate::core::{
    compare_servers_chart, fetch_asn_lane, fetch_server_lane, fetch_total_lane, lane_to_timeseries_lanes,
    parse_chart_epochs, PlayersResolution,
};
use crate::error::InsightsError;
use crate::metric::{
    labels, peak_players_24h, peak_players_24h_by_asn, peak_players_24h_by_server, peak_players_7d,
    LabeledInstantValue, PlayerCountEntry, PlayerCountRegistry, VmPushClient, VmQueryBuilder,
    VmQueryClient, VmRangeQuery,
};
use crate::metric::AlignedLane;

pub struct Insights {
    environment: String,
    query_client: RwLock<VmQueryClient>,
    push_client: RwLock<VmPushClient>,
    registry: RwLock<PlayerCountRegistry>,
}

impl Insights {
    pub fn new(
        query_base_url: impl Into<String>,
        import_url: impl Into<String>,
        auth_token: Option<String>,
        environment: impl Into<String>,
    ) -> Self {
        let query_base_url = query_base_url.into();
        let import_url = import_url.into();
        let environment = environment.into();
        Self {
            query_client: RwLock::new(VmQueryClient::new(query_base_url, auth_token.clone())),
            push_client: RwLock::new(VmPushClient::new(import_url, auth_token.clone())),
            registry: RwLock::new(PlayerCountRegistry::new(&environment)),
            environment,
        }
    }

    pub async fn refresh(
        &self,
        query_base_url: impl Into<String>,
        import_url: impl Into<String>,
        auth_token: Option<String>,
    ) {
        let query_base_url = query_base_url.into();
        let import_url = import_url.into();
        *self.query_client.write().await =
            VmQueryClient::new(query_base_url, auth_token.clone());
        *self.push_client.write().await = VmPushClient::new(import_url, auth_token.clone());
    }

    pub fn environment(&self) -> &str {
        &self.environment
    }

    pub async fn push_player_counts(
        &self,
        entries: &[PlayerCountEntry],
    ) -> Result<(), InsightsError> {
        let mut registry = self.registry.write().await;
        registry.reset();
        for entry in entries {
            registry.set(entry.clone());
        }
        let body = registry.encode();
        drop(registry);
        self.push_client.read().await.push(&body).await?;
        Ok(())
    }

    pub async fn peaks_24h_by_server_id(&self) -> BTreeMap<String, f64> {
        let mut peaks: BTreeMap<String, f64> = BTreeMap::new();
        for entry in self
            .labeled_instant(&peak_players_24h_by_server(self.environment()))
            .await
        {
            let Some(id) = label_value(&entry.labels, labels::ID) else {
                continue;
            };
            peaks
                .entry(id)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    pub async fn peaks_24h_by_asn_key(&self) -> BTreeMap<AsnPeakKey, f64> {
        let mut peaks: BTreeMap<AsnPeakKey, f64> = BTreeMap::new();
        for entry in self
            .labeled_instant(&peak_players_24h_by_asn(self.environment()))
            .await
        {
            let Some(asn) = label_value(&entry.labels, labels::ASN) else {
                continue;
            };
            let asn_org = label_value(&entry.labels, labels::ASN_ORG).unwrap_or_default();
            let key = AsnPeakKey { asn, asn_org };
            peaks
                .entry(key)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    pub async fn peak_players_24h(&self) -> Option<f64> {
        self.scalar(&peak_players_24h(self.environment())).await
    }

    pub async fn peak_players_7d(&self) -> Option<f64> {
        self.scalar(&peak_players_7d(self.environment())).await
    }

    pub async fn server_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        id: Uuid,
        from: i64,
        to: i64,
    ) -> Result<ServerTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let lane = fetch_server_lane(
            self,
            catalog,
            id,
            from,
            to,
            PlayersResolution::Chart,
        )
        .await?;
        let query = crate::core::build_players_query(
            PlayersResolution::Chart,
            catalog.environment(),
            from,
            to,
            Some(&id.to_string()),
            None,
        )?;
        Ok(ServerTimeseriesResponse {
            id: id.to_string(),
            timeseries: lane_to_timeseries_lanes(&lane, query.window()),
        })
    }

    pub async fn total_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        from: i64,
        to: i64,
    ) -> Result<ServerTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let lane =
            fetch_total_lane(self, catalog, from, to, PlayersResolution::Chart).await?;
        let query = crate::core::build_players_query(
            PlayersResolution::Chart,
            catalog.environment(),
            from,
            to,
            None,
            None,
        )?;
        Ok(ServerTimeseriesResponse {
            id: "total".to_string(),
            timeseries: lane_to_timeseries_lanes(&lane, query.window()),
        })
    }

    pub async fn asn_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        asn: &str,
        asn_org: &str,
        from: i64,
        to: i64,
    ) -> Result<AsnTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let lane = fetch_asn_lane(
            self,
            catalog,
            asn,
            asn_org,
            from,
            to,
            PlayersResolution::Chart,
        )
        .await?;
        let query = crate::core::build_players_query(
            PlayersResolution::Chart,
            catalog.environment(),
            from,
            to,
            None,
            Some((asn, asn_org)),
        )?;
        Ok(AsnTimeseriesResponse {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
            timeseries: lane_to_timeseries_lanes(&lane, query.window()),
        })
    }

    pub async fn compare_servers_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        ids: &[Uuid],
        from: i64,
        to: i64,
    ) -> Result<ServersCompareTimeseriesResponse, InsightsError> {
        compare_servers_chart(self, catalog, ids, from, to).await
    }

    pub(crate) async fn lane(&self, query: &VmRangeQuery) -> Result<AlignedLane, InsightsError> {
        self.query_client
            .read()
            .await
            .execute_lane(query)
            .await
            .map_err(InsightsError::from)
    }

    async fn labeled_instant(&self, promql: &str) -> Vec<LabeledInstantValue> {
        let query = match VmQueryBuilder::default().query(promql).build() {
            Ok(query) => query,
            Err(err) => {
                warn!(error = %err, "metrics labeled instant query build failed");
                return Vec::new();
            }
        };
        let client = self.query_client.read().await;
        let response = match client.execute(&query).await {
            Ok(response) => response,
            Err(err) => {
                warn!(error = %err, "metrics labeled instant query execute failed");
                return Vec::new();
            }
        };
        VmQueryClient::labeled_instant_values(&response)
    }

    async fn scalar(&self, promql: &str) -> Option<f64> {
        let query = match VmQueryBuilder::default().query(promql).build() {
            Ok(query) => query,
            Err(err) => {
                warn!(error = %err, "metrics scalar query build failed");
                return None;
            }
        };
        let client = self.query_client.read().await;
        let response = match client.execute(&query).await {
            Ok(response) => response,
            Err(err) => {
                warn!(error = %err, "metrics scalar query execute failed");
                return None;
            }
        };
        VmQueryClient::scalar_value(&response)
    }
}

fn label_value(labels: &serde_json::Map<String, serde_json::Value>, key: &str) -> Option<String> {
    labels.get(key).and_then(|value| match value {
        serde_json::Value::String(text) => Some(text.clone()),
        other => Some(other.to_string()),
    })
}
