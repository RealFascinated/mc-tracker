use thiserror::Error;

#[derive(Debug, Error)]
pub enum PingError {
    #[error("unknown hostname '{0}'")]
    UnknownHost(String),

    #[error("server '{0}' did not respond to ping")]
    NoResponse(String),

    #[error("hostname '{0}' returned an invalid ip")]
    InvalidIp(String),

    #[error("dns error for '{hostname}': {message}")]
    Dns { hostname: String, message: String },

    #[error("protocol error: {0}")]
    Protocol(String),

    #[error("ping failed for '{host}:{port}': {message}")]
    Io {
        host: String,
        port: u16,
        message: String,
    },

    #[error("ping attempts exhausted for '{0}'")]
    AttemptsExhausted(String),
}

impl PingError {
    pub fn from_dns(err: mc_dns::DnsError) -> Self {
        match err {
            mc_dns::DnsError::InvalidIp(host) => Self::InvalidIp(host),
            mc_dns::DnsError::Query { hostname, message } => Self::Dns { hostname, message },
        }
    }
}
