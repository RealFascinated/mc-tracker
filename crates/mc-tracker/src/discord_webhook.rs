//! Discord webhook notifications.
//!
//! Posts message embeds to a Discord webhook URL (server suggestions, ...).
//! Notifications are fire-and-forget: failures are logged, never surfaced to
//! the request that triggered them.

use std::time::Duration;

use serde::Serialize;
use tracing::warn;

/// Cap on how long a single webhook POST may take.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// A Discord webhook message:
/// <https://discord.com/developers/docs/resources/webhook#execute-webhook>
#[derive(Debug, Clone, Serialize)]
pub struct DiscordWebhookMessage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub embeds: Vec<DiscordEmbed>,
}

/// A Discord embed:
/// <https://discord.com/developers/docs/resources/message#embed-object>
#[derive(Debug, Clone, Serialize)]
pub struct DiscordEmbed {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<u32>,
    pub fields: Vec<DiscordEmbedField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

/// A Discord embed field (max 25 per embed; name and value up to 1024 chars).
#[derive(Debug, Clone, Serialize)]
pub struct DiscordEmbedField {
    pub name: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline: Option<bool>,
}

/// Sends webhook messages to a Discord webhook URL. Disabled when no URL is
/// configured.
#[derive(Clone)]
pub struct DiscordWebhook {
    client: reqwest::Client,
    url: Option<String>,
}

impl DiscordWebhook {
    /// Build a notifier from an optional webhook URL. `None` or an empty
    /// string disables notifications.
    pub fn new(url: Option<String>) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .expect("build reqwest client"),
            url: url
                .map(|url| url.trim().to_owned())
                .filter(|url| !url.is_empty()),
        }
    }

    /// Whether a webhook URL is configured.
    pub fn is_enabled(&self) -> bool {
        self.url.is_some()
    }

    /// Post `message` to the webhook URL. Errors are logged, never returned.
    pub async fn notify(&self, message: &DiscordWebhookMessage) {
        let Some(url) = &self.url else {
            return;
        };
        match self.client.post(url).json(message).send().await {
            Ok(response) if response.status().is_success() => {}
            Ok(response) => warn!(
                status = %response.status(),
                url = %url,
                "discord webhook rejected message"
            ),
            Err(error) => warn!(error = %error, url = %url, "discord webhook request failed"),
        }
    }
}
