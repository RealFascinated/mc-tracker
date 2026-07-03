use std::time::Duration;

pub const ASN_EDITION: &str = "GeoLite2-ASN";

/// Daily ASN database refresh at 2:00 local time.
pub const ASN_REFRESH_CRON: &str = "0 0 2 * * *";

pub const DOWNLOAD_URL: &str =
    "https://download.maxmind.com/app/geoip_download?edition_id={edition}&license_key={key}&suffix=tar.gz";

pub const STALE_AFTER: Duration = Duration::from_secs(3 * 24 * 60 * 60);
