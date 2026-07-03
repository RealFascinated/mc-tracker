mod cache;
mod constants;
mod error;
mod resolve;
mod resolver;
mod types;

pub use cache::DnsCache;
pub use constants::{DEFAULT_BEDROCK_PORT, DEFAULT_JAVA_PORT};
pub use error::DnsError;
pub use resolve::{resolve_bedrock, resolve_java};
pub use resolver::{DnsResolver, HickoryDnsResolver};
pub use types::{ResolvedTarget, SrvRecord};
