use thiserror::Error;

#[derive(Debug, Error)]
pub enum InsightsError {
    #[error("invalid time range: {0}")]
    InvalidRange(String),
    #[error("no data in range")]
    NoData,
}
