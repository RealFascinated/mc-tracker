use std::any::Any;
use std::collections::BTreeMap;

use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mc_api_types::{
    AsnTimeseriesResponse, ServerTimeseriesResponse, ServersCompareTimeseriesItem,
    ServersCompareTimeseriesResponse, TimeseriesLanes,
};
use tokio::sync::RwLock;
use tracing::warn;
use uuid::Uuid;

use crate::catalog::{AsnPeakKey, ServerCatalog};
use crate::core::{
    build_per_server_players_query, compare_servers_chart, fetch_asn_lane, fetch_server_lane,
    fetch_total_lane, fetch_total_lane_by_type, lane_to_timeseries_lanes, parse_chart_epochs,
    PlayersResolution,
};
use crate::error::InsightsError;
use crate::metric::AlignedLane;
use crate::metric::{
    avg_trend_by_server, labels, peak_players_24h, peak_players_24h_by_asn,
    peak_players_24h_by_server, peak_players_7d, LabeledInstantValue, PlayerCountEntry,
    PlayerCountRegistry, VmPushClient, VmQueryBuilder, VmQueryClient, VmRangeQuery,
};

const PEAK_CACHE_TTL: Duration = Duration::from_secs(5);
const TREND_CACHE_TTL: Duration = Duration::from_secs(10);

const KEY_PEAKS_24H_BY_SERVER: &str = "peaks_24h_by_server_id";
const KEY_PEAKS_24H_BY_ASN: &str = "peaks_24h_by_asn_key";
const KEY_PEAK_PLAYERS_24H: &str = "peak_players_24h";
const KEY_PEAK_PLAYERS_7D: &str = "peak_players_7d";
const KEY_TRENDS_BY_SERVER: &str = "trends_by_server_id";

/// Small in-process TTL cache for the expensive dashboard peak/trend queries.
///
/// These results change slowly (they aggregate 24h/7d/30d windows) yet are
/// recomputed on every dashboard poll (default every 30s per tab). Caching them
/// for a few seconds collapses the per-request VictoriaMetrics fan-out across
/// all concurrent viewers into a single upstream query per TTL window.
type CachedEntry = (Instant, Arc<dyn Any + Send + Sync>);

#[derive(Default)]
struct TtlCache {
    entries: RwLock<HashMap<&'static str, CachedEntry>>,
}

impl TtlCache {
    async fn get<T: Send + Sync + 'static>(
        &self,
        key: &'static str,
        ttl: Duration,
    ) -> Option<Arc<T>> {
        let entries = self.entries.read().await;
        let (at, value) = entries.get(key)?;
        if at.elapsed() >= ttl {
            return None;
        }
        value.clone().downcast().ok()
    }

    async fn insert<T: Send + Sync + 'static>(&self, key: &'static str, value: Arc<T>) {
        self.entries
            .write()
            .await
            .insert(key, (Instant::now(), value));
    }

    async fn clear(&self) {
        self.entries.write().await.clear();
    }
}

pub struct Insights {
    environment: String,
    query_client: RwLock<VmQueryClient>,
    push_client: RwLock<VmPushClient>,
    registry: RwLock<PlayerCountRegistry>,
    cache: TtlCache,
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
            cache: TtlCache::default(),
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
        *self.query_client.write().await = VmQueryClient::new(query_base_url, auth_token.clone());
        *self.push_client.write().await = VmPushClient::new(import_url, auth_token.clone());
        self.cache.clear().await;
    }

    pub fn environment(&self) -> &str {
        &self.environment
    }

    async fn cached<T: Send + Sync + 'static>(
        &self,
        key: &'static str,
        ttl: Duration,
        future: impl Future<Output = T>,
    ) -> Arc<T> {
        if let Some(value) = self.cache.get::<T>(key, ttl).await {
            return value;
        }
        let value = Arc::new(future.await);
        self.cache.insert(key, Arc::clone(&value)).await;
        value
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

    pub async fn peaks_24h_by_server_id(&self) -> Arc<BTreeMap<String, f64>> {
        self.cached(KEY_PEAKS_24H_BY_SERVER, PEAK_CACHE_TTL, async {
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
        })
        .await
    }

    pub async fn peaks_24h_by_asn_key(&self) -> Arc<BTreeMap<AsnPeakKey, f64>> {
        self.cached(KEY_PEAKS_24H_BY_ASN, PEAK_CACHE_TTL, async {
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
        })
        .await
    }

    pub async fn peak_players_24h(&self) -> Option<f64> {
        *self
            .cached(
                KEY_PEAK_PLAYERS_24H,
                PEAK_CACHE_TTL,
                self.scalar(&peak_players_24h(self.environment())),
            )
            .await
    }

    pub async fn peak_players_7d(&self) -> Option<f64> {
        *self
            .cached(
                KEY_PEAK_PLAYERS_7D,
                PEAK_CACHE_TTL,
                self.scalar(&peak_players_7d(self.environment())),
            )
            .await
    }

    /// Returns per-server trend percentages for 24h, 7d, and 30d windows.
    ///
    /// All trends use daily averages (`avg_over_time(24h)`) as the base unit for
    /// stability, then compare to the equivalent period in the past:
    /// - 24h trend: today's daily avg vs yesterday's daily avg
    /// - 7d trend:  this week's avg vs last week's avg
    /// - 30d trend: this month's avg vs last month's avg
    ///
    /// Values outside ±500% are discarded (noisy — typically servers that just
    /// started tracking or were offline in the reference period).
    pub async fn trends_by_server_id(
        &self,
    ) -> Arc<HashMap<String, (Option<f64>, Option<f64>, Option<f64>)>> {
        self.cached(KEY_TRENDS_BY_SERVER, TREND_CACHE_TTL, async {
            let env = self.environment();
            let q_24h = avg_trend_by_server(env, "24h", "24h");
            let q_7d = avg_trend_by_server(env, "7d", "7d");
            let q_30d = avg_trend_by_server(env, "30d", "30d");
            let (trends_24h, trends_7d, trends_30d) = tokio::join!(
                self.labeled_instant(&q_24h),
                self.labeled_instant(&q_7d),
                self.labeled_instant(&q_30d),
            );

            let sanitize = |v: f64| {
                if v.is_finite() && v.abs() <= 500.0 {
                    Some(v)
                } else {
                    None
                }
            };

            let mut all: HashMap<String, (Option<f64>, Option<f64>, Option<f64>)> = HashMap::new();

            for entry in trends_24h {
                let Some(id) = label_value(&entry.labels, labels::ID) else {
                    continue;
                };
                all.entry(id).or_default().0 = sanitize(entry.value);
            }
            for entry in trends_7d {
                let Some(id) = label_value(&entry.labels, labels::ID) else {
                    continue;
                };
                all.entry(id).or_default().1 = sanitize(entry.value);
            }
            for entry in trends_30d {
                let Some(id) = label_value(&entry.labels, labels::ID) else {
                    continue;
                };
                all.entry(id).or_default().2 = sanitize(entry.value);
            }

            all
        })
        .await
    }

    pub async fn server_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        id: Uuid,
        from: i64,
        to: i64,
        daily_avg: bool,
        weekly_avg: bool,
    ) -> Result<ServerTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let lane = fetch_server_lane(self, catalog, id, from, to, PlayersResolution::Chart).await?;
        let query = crate::core::build_players_query(
            PlayersResolution::Chart,
            catalog.environment(),
            from,
            to,
            Some(&id.to_string()),
            None,
        )?;
        let mut lanes = lane_to_timeseries_lanes(&lane, query.window());

        if daily_avg {
            if let Ok(avg_lane) =
                fetch_server_lane(self, catalog, id, from, to, PlayersResolution::DailyAverage)
                    .await
            {
                lanes.insert_lane(
                    mc_api_types::timeseries_keys::PLAYERS_DAILY_AVG,
                    avg_lane.step_secs,
                    avg_lane.timestamps.clone(),
                    avg_lane.values.clone(),
                );
            }
        }

        if weekly_avg {
            if let Ok(avg_lane) = fetch_server_lane(
                self,
                catalog,
                id,
                from,
                to,
                PlayersResolution::WeeklyAverage,
            )
            .await
            {
                lanes.insert_lane(
                    mc_api_types::timeseries_keys::PLAYERS_WEEKLY_AVG,
                    avg_lane.step_secs,
                    avg_lane.timestamps.clone(),
                    avg_lane.values.clone(),
                );
            }
        }

        Ok(ServerTimeseriesResponse {
            id: id.to_string(),
            timeseries: lanes,
            events: vec![],
        })
    }

    pub async fn total_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        from: i64,
        to: i64,
    ) -> Result<ServerTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let resolution = PlayersResolution::Chart;

        let (total_lane, java_lane, bedrock_lane) = tokio::join!(
            fetch_total_lane(self, catalog, from, to, resolution),
            fetch_total_lane_by_type(self, catalog, "PC", from, to, resolution),
            fetch_total_lane_by_type(self, catalog, "PE", from, to, resolution),
        );

        let query = crate::core::build_players_query(
            resolution,
            catalog.environment(),
            from,
            to,
            None,
            None,
        )?;

        let mut lanes =
            TimeseriesLanes::new(query.window().from_epoch(), query.window().to_epoch());

        if let Ok(lane) = total_lane {
            lanes.insert_lane(
                mc_api_types::timeseries_keys::PLAYERS_ONLINE,
                lane.step_secs,
                lane.timestamps.clone(),
                lane.values.clone(),
            );
        }
        if let Ok(lane) = java_lane {
            lanes.insert_lane(
                mc_api_types::timeseries_keys::PLAYERS_JAVA,
                lane.step_secs,
                lane.timestamps.clone(),
                lane.values.clone(),
            );
        }
        if let Ok(lane) = bedrock_lane {
            lanes.insert_lane(
                mc_api_types::timeseries_keys::PLAYERS_BEDROCK,
                lane.step_secs,
                lane.timestamps.clone(),
                lane.values.clone(),
            );
        }

        Ok(ServerTimeseriesResponse {
            id: "total".to_string(),
            timeseries: lanes,
            events: vec![],
        })
    }

    pub async fn per_server_players_lanes(
        &self,
        catalog: &dyn ServerCatalog,
        from: i64,
        to: i64,
    ) -> Result<ServersCompareTimeseriesResponse, InsightsError> {
        parse_chart_epochs(from, to)?;
        let query = build_per_server_players_query(catalog.environment(), from, to)?;

        let labeled_lanes = self
            .query_client
            .read()
            .await
            .execute_labeled_lanes(&query, "id")
            .await
            .map_err(InsightsError::from)?;

        let mut servers = Vec::with_capacity(labeled_lanes.len());

        for (id_str, lane) in &labeled_lanes {
            let id = match uuid::Uuid::parse_str(id_str) {
                Ok(id) => id,
                Err(_) => continue,
            };
            let meta = match catalog.server_detail(id).await {
                Some(meta) => meta,
                None => continue,
            };
            let mut lanes = TimeseriesLanes::new(from, to);
            lanes.insert_lane(
                mc_api_types::timeseries_keys::PLAYERS_ONLINE,
                lane.step_secs,
                lane.timestamps.clone(),
                lane.values.clone(),
            );
            servers.push(ServersCompareTimeseriesItem {
                id: meta.id.to_string(),
                name: meta.name,
                timeseries: lanes,
            });
        }

        Ok(ServersCompareTimeseriesResponse {
            from,
            to,
            servers,
            errors: vec![],
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
