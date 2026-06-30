use thiserror::Error;

#[derive(Debug, Error)]
pub enum GeoError {
    #[error("maxmind license key is required")]
    MissingLicenseKey,

    #[error("asn database not loaded")]
    DatabaseNotLoaded,

    #[error("failed to initialize asn database: {0}")]
    Init(String),

    #[error("invalid ip address: {0}")]
    InvalidIp(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("download failed: {0}")]
    Download(String),

    #[error("maxmind database error: {0}")]
    Database(#[from] maxminddb::MaxMindDbError),
}
