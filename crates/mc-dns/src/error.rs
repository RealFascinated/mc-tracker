use thiserror::Error;

#[derive(Debug, Error)]
pub enum DnsError {
    #[error("hostname '{0}' returned an invalid ip")]
    InvalidIp(String),

    #[error("dns error for '{hostname}': {message}")]
    Query {
        hostname: String,
        message: String,
    },
}

impl DnsError {
    pub fn query(hostname: impl Into<String>, message: impl std::fmt::Display) -> Self {
        Self::Query {
            hostname: hostname.into(),
            message: message.to_string(),
        }
    }
}
