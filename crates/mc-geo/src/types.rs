pub const ASN_EDITION: &str = "GeoLite2-ASN";

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct AsnLookup {
    pub asn: String,
    pub asn_org: String,
    pub cidr: Option<String>,
}

impl AsnLookup {
    pub fn empty() -> Self {
        Self::default()
    }

    pub fn is_empty(&self) -> bool {
        self.asn.is_empty() && self.asn_org.is_empty()
    }
}

#[derive(Debug, Clone)]
pub struct GeoConfig {
    pub license_key: String,
    pub database_dir: String,
}
