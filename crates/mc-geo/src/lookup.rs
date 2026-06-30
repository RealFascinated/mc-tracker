use std::net::IpAddr;
use std::path::{Path, PathBuf};

use maxminddb::geoip2;
use maxminddb::Reader;

use crate::error::GeoError;
use crate::ip::is_non_public;
use crate::types::AsnLookup;

pub struct AsnDatabase {
    path: PathBuf,
    reader: Reader<Vec<u8>>,
}

impl AsnDatabase {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, GeoError> {
        let path = path.as_ref().to_path_buf();
        let reader = Reader::open_readfile(&path).map_err(|e| GeoError::Init(e.to_string()))?;
        Ok(Self { path, reader })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn lookup(&self, ip: &str) -> Result<AsnLookup, GeoError> {
        let addr: IpAddr = ip
            .parse()
            .map_err(|_| GeoError::InvalidIp(ip.to_string()))?;

        if is_non_public(addr) {
            return Ok(AsnLookup::empty());
        }

        let result = self.reader.lookup(addr)?;
        let Some(record) = result.decode::<geoip2::Asn>()? else {
            return Ok(AsnLookup::empty());
        };

        let asn = record
            .autonomous_system_number
            .map(|n| format!("AS{n}"))
            .unwrap_or_default();
        let asn_org = record
            .autonomous_system_organization
            .unwrap_or_default()
            .to_string();
        let cidr = result.network().ok().map(|network| network.to_string());

        Ok(AsnLookup { asn, asn_org, cidr })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/GeoLite2-ASN-Test.mmdb")
    }

    #[test]
    fn known_public_ip_returns_asn() {
        let db = AsnDatabase::open(fixture_path()).unwrap();
        let lookup = db.lookup("1.128.0.0").unwrap();
        assert_eq!(lookup.asn, "AS1221");
        assert_eq!(lookup.asn_org, "Telstra Pty Ltd");
        assert_eq!(lookup.cidr.as_deref(), Some("1.128.0.0/11"));
    }

    #[test]
    fn private_ip_returns_empty_without_db_hit() {
        let db = AsnDatabase::open(fixture_path()).unwrap();
        let lookup = db.lookup("127.0.0.1").unwrap();
        assert!(lookup.is_empty());
    }

    #[test]
    fn missing_record_returns_empty() {
        let db = AsnDatabase::open(fixture_path()).unwrap();
        let lookup = db.lookup("8.8.8.8").unwrap();
        assert!(lookup.is_empty());
    }
}
