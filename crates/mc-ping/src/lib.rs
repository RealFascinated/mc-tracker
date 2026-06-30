pub mod bedrock;
pub mod error;
pub mod java;
pub mod net;
pub mod retry;
pub mod types;

pub use bedrock::ping_bedrock;
pub use error::PingError;
pub use java::pinger::ping_java;
pub use mc_dns::{
    resolve_bedrock, resolve_java, DnsCache, DnsError, DnsResolver, HickoryDnsResolver,
    JavaResolveResult, ResolvedTarget, SrvRecord, DEFAULT_BEDROCK_PORT, DEFAULT_JAVA_PORT,
};
pub use retry::with_retry;
pub use types::{Motd, Ping, Players, ServerVersion};
