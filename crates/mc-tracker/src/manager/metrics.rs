use std::collections::BTreeMap;

use mc_db::AppSettings;
use mc_metrics::{
    peak_players_24h_by_asn, peak_players_24h_by_server, VmPushClient, VmQueryBuilder,
    VmQueryClient,
};
use tracing::warn;

use super::mappers::{asn_key_from_labels, label_value};
use super::search::AsnAggregateKey;
use super::ServerManager;

impl ServerManager {
    pub(crate) async fn refresh_vm_clients(&self, settings: &AppSettings) {
        *self.push_client.write().await = VmPushClient::new(
            settings.victoriametrics_import_url(),
            self.vm_auth_token.clone(),
        );
        *self.query_client.write().await = VmQueryClient::new(
            settings.victoriametrics_base_url(),
            self.vm_auth_token.clone(),
        );
    }

    pub(crate) async fn peaks_24h_by_server_id(&self, environment: &str) -> BTreeMap<String, f64> {
        let mut peaks: BTreeMap<String, f64> = BTreeMap::new();
        for entry in self
            .query_labeled_instant(peak_players_24h_by_server(environment))
            .await
        {
            let Some(id) = label_value(&entry.labels, mc_metrics::labels::ID) else {
                continue;
            };
            peaks
                .entry(id)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    pub(crate) async fn peaks_24h_by_asn_key(
        &self,
        environment: &str,
    ) -> BTreeMap<AsnAggregateKey, f64> {
        let mut peaks: BTreeMap<AsnAggregateKey, f64> = BTreeMap::new();
        for entry in self
            .query_labeled_instant(peak_players_24h_by_asn(environment))
            .await
        {
            let Some(key) = asn_key_from_labels(&entry.labels) else {
                continue;
            };
            peaks
                .entry(key)
                .and_modify(|current| *current = current.max(entry.value))
                .or_insert(entry.value);
        }
        peaks
    }

    pub(crate) async fn asn_is_tracked(&self, asn: &str, asn_org: &str) -> bool {
        self.servers
            .read()
            .await
            .iter()
            .filter(|server| server.is_tracking())
            .any(|server| server.asn.asn == asn && server.asn.asn_org == asn_org)
    }

    async fn query_labeled_instant(&self, promql: String) -> Vec<mc_metrics::LabeledInstantValue> {
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

    pub(crate) async fn query_scalar(&self, build_query: fn(&str) -> String) -> Option<f64> {
        self.query_scalar_promql(build_query(self.environment()))
            .await
    }

    async fn query_scalar_promql(&self, promql: String) -> Option<f64> {
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
