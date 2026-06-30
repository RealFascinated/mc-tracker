use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("database error: {0}")]
    Database(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("invalid settings: {0}")]
    InvalidSettings(String),
    #[error("bootstrap error: {0}")]
    Bootstrap(String),
}

impl DbError {
    pub fn database(err: impl std::fmt::Display) -> Self {
        Self::Database(err.to_string())
    }
}

impl From<diesel::result::Error> for DbError {
    fn from(err: diesel::result::Error) -> Self {
        Self::database(err)
    }
}
