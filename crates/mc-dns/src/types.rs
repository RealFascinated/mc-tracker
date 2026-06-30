pub const DEFAULT_JAVA_PORT: u16 = 25565;
pub const DEFAULT_BEDROCK_PORT: u16 = 19132;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SrvRecord {
    pub target: String,
    pub port: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedTarget {
    pub hostname: String,
    pub port: u16,
    pub ip: String,
}

/// Backward-compatible alias — same shape for Java and Bedrock resolve results.
pub type JavaResolveResult = ResolvedTarget;
