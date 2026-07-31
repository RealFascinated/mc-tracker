use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::Platform;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServerSuggestionStatus {
    Pending,
    Approved,
    Denied,
}

impl ServerSuggestionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Approved => "approved",
            Self::Denied => "denied",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "pending" => Ok(Self::Pending),
            "approved" => Ok(Self::Approved),
            "denied" => Ok(Self::Denied),
            other => Err(format!("unknown server suggestion status: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerSuggestion {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    pub platform: Platform,
    pub status: ServerSuggestionStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
