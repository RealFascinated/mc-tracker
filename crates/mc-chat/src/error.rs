use thiserror::Error;

#[derive(Debug, Error)]
pub enum ChatError {
    #[error("llm request failed: {0}")]
    Llm(String),
    #[error("tool error: {0}")]
    Tool(String),
    #[error("invalid request: {0}")]
    InvalidRequest(String),
    #[error("agent limit exceeded: {0}")]
    Limit(String),
    #[error("insights error: {0}")]
    Insights(#[from] mc_insights::InsightsError),
}
