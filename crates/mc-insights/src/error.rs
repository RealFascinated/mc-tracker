use thiserror::Error;

use mc_api_types::{ApiError, ApiErrorCode, ErrorTarget, PartialError};

#[derive(Debug, Error)]
pub enum InsightsError {
    #[error("invalid time range: {0}")]
    InvalidRange(String),
    #[error("no data in range")]
    NoData,
}

impl InsightsError {
    pub fn api_code(&self) -> ApiErrorCode {
        match self {
            Self::InvalidRange(message) if message == "server not found" => {
                ApiErrorCode::ServerNotFound
            }
            Self::InvalidRange(_) => ApiErrorCode::InvalidRange,
            Self::NoData => ApiErrorCode::NoData,
        }
    }

    pub fn api_message(&self) -> String {
        match self {
            Self::InvalidRange(message) if message == "server not found" => {
                "server not found".into()
            }
            Self::InvalidRange(message) => format!("invalid time range: {message}"),
            Self::NoData => "no data in range".into(),
        }
    }

    pub fn to_api_error(&self) -> ApiError {
        ApiError::new(self.api_code(), self.api_message())
    }

    pub fn to_partial_error(&self, target: ErrorTarget) -> PartialError {
        PartialError::new(self.api_code(), self.api_message(), target)
    }
}
