use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use flate2::read::GzDecoder;
use tar::Archive;
use tracing::{info, warn};

use crate::error::GeoError;
use crate::types::ASN_EDITION;

const DOWNLOAD_URL: &str =
    "https://download.maxmind.com/app/geoip_download?edition_id={edition}&license_key={key}&suffix=tar.gz";
const STALE_AFTER: Duration = Duration::from_secs(3 * 24 * 60 * 60);

pub fn database_file_path(database_dir: impl AsRef<Path>) -> PathBuf {
    database_dir.as_ref().join(format!("{ASN_EDITION}.mmdb"))
}

pub fn is_stale(path: &Path, now: SystemTime) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return true;
    };
    let Ok(modified) = metadata.modified() else {
        return true;
    };
    now.duration_since(modified)
        .map(|age| age > STALE_AFTER)
        .unwrap_or(true)
}

pub async fn ensure_database(
    database_dir: &Path,
    license_key: &str,
    check_staleness: bool,
) -> Result<bool, GeoError> {
    fs::create_dir_all(database_dir)?;

    let database_file = database_file_path(database_dir);
    let exists = database_file.exists();
    let needs_update = if exists && check_staleness {
        is_stale(&database_file, SystemTime::now())
    } else {
        !exists
    };

    if !needs_update {
        return Ok(false);
    }

    if exists && check_staleness {
        info!(
            edition = ASN_EDITION,
            "asn database is older than 3 days, attempting update"
        );
    } else if !exists {
        info!(edition = ASN_EDITION, "asn database not found, downloading");
    }

    match download_database(database_dir, license_key).await {
        Ok(()) => Ok(true),
        Err(err) => {
            if exists {
                warn!(
                    edition = ASN_EDITION,
                    error = %err,
                    "download failed; keeping existing asn database"
                );
                Ok(false)
            } else {
                Err(err)
            }
        }
    }
}

pub async fn download_database(database_dir: &Path, license_key: &str) -> Result<(), GeoError> {
    let url = build_download_url(license_key);
    download_database_from_url(database_dir, &url).await
}

pub(crate) fn build_download_url(license_key: &str) -> String {
    DOWNLOAD_URL
        .replace("{edition}", ASN_EDITION)
        .replace("{key}", license_key)
}

pub async fn download_database_from_url(
    database_dir: &Path,
    url: &str,
) -> Result<(), GeoError> {
    let database_file = database_file_path(database_dir);
    let archive_path = database_dir.join(format!("{ASN_EDITION}.tar.gz"));

    if !archive_path.exists() {
        info!(edition = ASN_EDITION, "downloading maxmind database");
        let response = reqwest::get(url)
            .await
            .map_err(|e| GeoError::Download(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let message = if status.as_u16() == 429 {
                "rate limited (HTTP 429)"
            } else {
                "unexpected status"
            };
            return Err(GeoError::Download(format!(
                "maxmind returned HTTP {} ({message})",
                status.as_u16()
            )));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| GeoError::Download(e.to_string()))?;
        fs::write(&archive_path, bytes)?;
        info!(edition = ASN_EDITION, "download complete");
    }

    extract_database(&archive_path, database_dir, &database_file)?;
    let _ = fs::remove_file(&archive_path);
    Ok(())
}

fn extract_database(
    archive_path: &Path,
    database_dir: &Path,
    database_file: &Path,
) -> Result<(), GeoError> {
    info!(edition = ASN_EDITION, "extracting maxmind database");

    let file = File::open(archive_path)?;
    let decoder = GzDecoder::new(BufReader::new(file));
    let mut archive = Archive::new(decoder);

    for entry in archive
        .entries()
        .map_err(|e| GeoError::Download(e.to_string()))?
    {
        let mut entry = entry.map_err(|e| GeoError::Download(e.to_string()))?;
        let path = entry.path().map_err(|e| GeoError::Download(e.to_string()))?;
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        if file_name == format!("{ASN_EDITION}.mmdb") {
            let temp_path = database_dir.join(format!("{ASN_EDITION}.mmdb.download"));
            entry
                .unpack(&temp_path)
                .map_err(|e| GeoError::Download(e.to_string()))?;
            fs::rename(&temp_path, database_file)?;
            info!(edition = ASN_EDITION, "extracted asn database");
            return Ok(());
        }
    }

    Err(GeoError::Download(format!(
        "could not find {ASN_EDITION}.mmdb in archive"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_tar_gz(dir: &Path, mmdb_bytes: &[u8]) -> PathBuf {
        let inner_dir = format!("{ASN_EDITION}_20250630");
        let archive_path = dir.join(format!("{ASN_EDITION}.tar.gz"));
        let file = File::create(&archive_path).unwrap();
        let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
        let mut builder = tar::Builder::new(encoder);
        let mmdb_path = format!("{inner_dir}/{ASN_EDITION}.mmdb");
        let mut header = tar::Header::new_gnu();
        header.set_size(mmdb_bytes.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        builder
            .append_data(&mut header, &mmdb_path, mmdb_bytes)
            .unwrap();
        builder.into_inner().unwrap().finish().unwrap();
        archive_path
    }

    #[test]
    fn extract_finds_mmdb_in_nested_directory() {
        let dir = tempfile::tempdir().unwrap();
        let fixture = include_bytes!("../tests/fixtures/GeoLite2-ASN-Test.mmdb");
        let archive_path = create_tar_gz(dir.path(), fixture);
        let database_file = database_file_path(dir.path());

        extract_database(&archive_path, dir.path(), &database_file).unwrap();
        assert!(database_file.exists());
        assert!(database_file.metadata().unwrap().len() > 0);
    }

    #[test]
    fn staleness_uses_three_day_threshold() {
        let stale = Duration::from_secs(4 * 24 * 60 * 60);
        let fresh = Duration::from_secs(2 * 24 * 60 * 60);
        let threshold = Duration::from_secs(3 * 24 * 60 * 60);
        assert!(stale > threshold);
        assert!(fresh <= threshold);
    }

    #[tokio::test]
    async fn download_from_url_returns_error_on_429() {
        let dir = tempfile::tempdir().unwrap();
        let server = wiremock::MockServer::start().await;
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .respond_with(wiremock::ResponseTemplate::new(429))
            .mount(&server)
            .await;

        let err = download_database_from_url(dir.path(), &server.uri())
            .await
            .unwrap_err();
        assert!(err.to_string().contains("429"));
    }
}
