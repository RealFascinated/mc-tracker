use mc_chat_types::{ChatErrorCode, ChatErrorTarget, ChatPartialError};
use thiserror::Error;

use crate::metric::MetricsError;

#[derive(Debug, Error)]
pub enum InsightsError {
    #[error("invalid time range: {0}")]
    InvalidRange(String),
    #[error("no data in range")]
    NoData,
    #[error("http error: {0}")]
    Http(String),
    #[error("victoria metrics error: {0}")]
    VictoriaMetrics(String),
    #[error("failed to parse victoria metrics response: {0}")]
    Parse(String),
}

impl InsightsError {
    pub fn code(&self) -> ChatErrorCode {
        match self {
            Self::InvalidRange(message) if message == "server not found" => {
                ChatErrorCode::ServerNotFound
            }
            Self::InvalidRange(message) if message == "asn not found" => ChatErrorCode::AsnNotFound,
            Self::InvalidRange(_) => ChatErrorCode::InvalidRange,
            Self::NoData => ChatErrorCode::NoData,
            Self::Http(_) | Self::VictoriaMetrics(_) | Self::Parse(_) => ChatErrorCode::InvalidRange,
        }
    }

    pub fn message(&self) -> String {
        match self {
            Self::InvalidRange(message) if message == "server not found" => {
                "server not found".into()
            }
            Self::InvalidRange(message) if message == "asn not found" => "asn not found".into(),
            Self::InvalidRange(message) => format!("invalid time range: {message}"),
            Self::NoData => "no data in range".into(),
            Self::Http(message) | Self::VictoriaMetrics(message) | Self::Parse(message) => {
                message.clone()
            }
        }
    }

    pub fn to_partial_error(&self, target: ChatErrorTarget) -> ChatPartialError {
        ChatPartialError::new(self.code(), self.message(), target)
    }
}

impl From<MetricsError> for InsightsError {
    fn from(err: MetricsError) -> Self {
        match err {
            MetricsError::InvalidWindow(message) => Self::InvalidRange(message),
            MetricsError::Http(message) => Self::Http(message),
            MetricsError::VictoriaMetrics(message) => Self::VictoriaMetrics(message),
            MetricsError::Parse(message) => Self::Parse(message),
        }
    }
}
