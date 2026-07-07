use thiserror::Error;

#[derive(Debug, Error)]
pub enum MetricsError {
    #[error("invalid metric window: {0}")]
    InvalidWindow(String),

    #[error("http error: {0}")]
    Http(String),

    #[error("victoria metrics error: {0}")]
    VictoriaMetrics(String),

    #[error("failed to parse victoria metrics response: {0}")]
    Parse(String),
}
