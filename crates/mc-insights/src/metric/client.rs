use std::collections::BTreeMap;
use std::time::UNIX_EPOCH;

use serde::Deserialize;

use crate::metric::error::MetricsError;
use crate::metric::query::{align_samples_to_window, AlignedLane, VmQuery, VmRangeQuery};

#[derive(Debug, Clone)]
pub struct VmQueryClient {
    client: reqwest::Client,
    base_url: String,
    auth_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VmResponseEnvelope {
    status: String,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    data: Option<VmResponseData>,
}

#[derive(Debug, Deserialize)]
struct VmResponseData {
    #[serde(rename = "resultType")]
    _result_type: String,
    #[serde(default)]
    result: Vec<VmResult>,
}

#[derive(Debug, Clone, Deserialize)]
struct VmResult {
    #[serde(default)]
    metric: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    value: Option<(f64, String)>,
    #[serde(default)]
    values: Vec<(f64, String)>,
}

#[derive(Debug, Clone)]
pub struct VmQueryResponse {
    results: Vec<VmResult>,
}

#[derive(Debug, Clone)]
pub struct LabeledInstantValue {
    pub labels: serde_json::Map<String, serde_json::Value>,
    pub value: f64,
}

impl VmQueryClient {
    pub fn new(base_url: impl Into<String>, auth_token: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.into().trim_end_matches('/').to_string(),
            auth_token,
        }
    }

    pub async fn execute(&self, query: &VmQuery) -> Result<VmQueryResponse, MetricsError> {
        let url = if query.is_range() {
            format!(
                "{}/api/v1/query_range?query={}&start={}&end={}&step={}",
                self.base_url,
                urlencoding::encode(query.promql()),
                epoch_seconds(query.from().unwrap()),
                epoch_seconds(query.to().unwrap()),
                urlencoding::encode(&query.step_param()?),
            )
        } else {
            format!(
                "{}/api/v1/query?query={}&time={}",
                self.base_url,
                urlencoding::encode(query.promql()),
                epoch_seconds(query.at().unwrap_or_else(std::time::SystemTime::now)),
            )
        };

        let mut request = self.client.get(&url);
        if let Some(token) = &self.auth_token {
            request = request.header("Authorization", format!("Bearer {token}"));
        }

        let response = request
            .send()
            .await
            .map_err(|e| MetricsError::Http(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(MetricsError::VictoriaMetrics(format!(
                "query failed with HTTP {status}: {body}"
            )));
        }

        let envelope: VmResponseEnvelope = response
            .json()
            .await
            .map_err(|e| MetricsError::Parse(e.to_string()))?;

        if envelope.status != "success" {
            return Err(MetricsError::VictoriaMetrics(
                envelope.error.unwrap_or_else(|| "unknown error".into()),
            ));
        }

        let data = envelope
            .data
            .ok_or_else(|| MetricsError::Parse("missing data field".into()))?;

        Ok(VmQueryResponse {
            results: data.result,
        })
    }

    pub fn scalar_value(response: &VmQueryResponse) -> Option<f64> {
        response
            .results
            .first()
            .and_then(|result| result.value.as_ref())
            .and_then(|(_, value)| value.parse().ok())
    }

    /// One entry per instant-vector result, preserving series labels.
    pub fn labeled_instant_values(response: &VmQueryResponse) -> Vec<LabeledInstantValue> {
        response
            .results
            .iter()
            .filter_map(|result| {
                let value = result.value.as_ref()?.1.parse().ok()?;
                Some(LabeledInstantValue {
                    labels: result.metric.clone(),
                    value,
                })
            })
            .collect()
    }

    /// Merge all matrix series, taking the max value when timestamps collide.
    pub fn matrix_samples(response: &VmQueryResponse) -> Vec<(i64, Option<f64>)> {
        let mut merged: BTreeMap<i64, f64> = BTreeMap::new();

        for result in &response.results {
            for (timestamp, value) in &result.values {
                let Some(parsed) = value.parse::<f64>().ok() else {
                    continue;
                };
                let timestamp = normalize_timestamp(*timestamp);
                merged
                    .entry(timestamp)
                    .and_modify(|current| *current = current.max(parsed))
                    .or_insert(parsed);
            }
        }

        merged
            .into_iter()
            .map(|(timestamp, value)| (timestamp, Some(value)))
            .collect()
    }

    pub async fn execute_range(
        &self,
        query: &VmRangeQuery,
    ) -> Result<Vec<(i64, Option<f64>)>, MetricsError> {
        let vm_query = query.to_vm_query()?;
        let response = self.execute(&vm_query).await?;
        Ok(Self::matrix_samples(&response))
    }

    pub async fn execute_lane(&self, query: &VmRangeQuery) -> Result<AlignedLane, MetricsError> {
        let window = query.window();
        let samples = self.execute_range(query).await?;
        let (timestamps, values) = align_samples_to_window(window, &samples);
        Ok(AlignedLane {
            step_secs: window.step_seconds(),
            timestamps,
            values,
        })
    }
}

fn normalize_timestamp(timestamp: f64) -> i64 {
    if timestamp > 1_000_000_000_000.0 {
        (timestamp / 1000.0) as i64
    } else {
        timestamp as i64
    }
}

fn epoch_seconds(time: std::time::SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metric::query::VmQueryBuilder;
    use std::time::{Duration, UNIX_EPOCH};
    use wiremock::matchers::{method, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn execute_instant_query() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(query_param("query", "up"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [{ "value": [1710000000.0, "42"] }]
                }
            })))
            .mount(&server)
            .await;

        let client = VmQueryClient::new(server.uri(), None);
        let query = VmQueryBuilder::default()
            .query("up")
            .at(UNIX_EPOCH + Duration::from_secs(1710000000))
            .build()
            .unwrap();
        let response = client.execute(&query).await.unwrap();
        assert_eq!(VmQueryClient::scalar_value(&response), Some(42.0));
    }

    #[tokio::test]
    async fn execute_range_query() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(query_param("step", "15s"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "success",
                "data": {
                    "resultType": "matrix",
                    "result": [{
                        "values": [[1710000000.0, "10"], [1710000015.0, "12"]]
                    }]
                }
            })))
            .mount(&server)
            .await;

        let client = VmQueryClient::new(server.uri(), None);
        let query = VmQueryBuilder::default()
            .query("minecraft_server_player_count")
            .from(UNIX_EPOCH + Duration::from_secs(1710000000))
            .to(UNIX_EPOCH + Duration::from_secs(1710000100))
            .step(Duration::from_secs(15))
            .build()
            .unwrap();
        let response = client.execute(&query).await.unwrap();
        let values = VmQueryClient::matrix_samples(&response);
        assert_eq!(values.len(), 2);
        assert_eq!(values[0], (1710000000, Some(10.0)));
    }
}
