pub mod chat_session;
pub mod pinned_server;
pub mod settings;
pub mod settings_constants;
pub mod user_flags;

pub use chat_session::{ChatSessionSummary, ChatTurnRow};
pub use pinned_server::PinnedServer;
pub use settings::AppSettings;
pub use user_flags::{chat_quota_exempt, UserFlags};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Platform {
    Pc,
    Pe,
}

impl Platform {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pc => "PC",
            Self::Pe => "PE",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "PC" => Ok(Self::Pc),
            "PE" => Ok(Self::Pe),
            other => Err(format!("unknown platform: {other}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    User,
}

impl UserRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::User => "user",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "admin" => Ok(Self::Admin),
            "user" => Ok(Self::User),
            other => Err(format!("unknown role: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Server {
    pub id: Uuid,
    pub name: String,
    pub host: String,
    pub port: Option<i32>,
    pub platform: Platform,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub peak_players: Option<u32>,
    pub peak_players_timestamp: Option<i64>,
    pub paused: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub role: UserRole,
    pub flags: UserFlags,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
