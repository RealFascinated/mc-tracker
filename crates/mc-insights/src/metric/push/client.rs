use crate::metric::error::MetricsError;

pub struct VmPushClient {
    client: reqwest::Client,
    import_url: String,
    auth_token: Option<String>,
}

impl VmPushClient {
    pub fn new(import_url: impl Into<String>, auth_token: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            import_url: import_url.into(),
            auth_token,
        }
    }

    pub async fn push(&self, body: &str) -> Result<(), MetricsError> {
        let mut request = self
            .client
            .post(&self.import_url)
            .header("Content-Type", "text/plain; version=0.0.4")
            .body(body.to_string());

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
                "push failed with HTTP {status}: {body}"
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_string, header, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn push_posts_prometheus_body() {
        let server = MockServer::start().await;
        let body = "minecraft_server_player_count 1\n";

        Mock::given(method("POST"))
            .and(header("Content-Type", "text/plain; version=0.0.4"))
            .and(body_string(body))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let client = VmPushClient::new(server.uri(), None);
        client.push(body).await.unwrap();
    }

    #[tokio::test]
    async fn push_sends_bearer_token_when_configured() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(header("Authorization", "Bearer secret"))
            .respond_with(ResponseTemplate::new(204))
            .mount(&server)
            .await;

        let client = VmPushClient::new(server.uri(), Some("secret".into()));
        client.push("metric 1\n").await.unwrap();
    }
}
