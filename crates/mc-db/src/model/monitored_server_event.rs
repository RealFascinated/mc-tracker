use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::Platform;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MonitoredServerEventType {
    Added,
    Removed,
    Paused,
    Unpaused,
}

impl MonitoredServerEventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Removed => "removed",
            Self::Paused => "paused",
            Self::Unpaused => "unpaused",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "added" => Ok(Self::Added),
            "removed" => Ok(Self::Removed),
            "paused" => Ok(Self::Paused),
            "unpaused" => Ok(Self::Unpaused),
            other => Err(format!("unknown monitored server event type: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MonitoredServerEvent {
    pub id: Uuid,
    pub server_id: Uuid,
    pub server_name: String,
    pub server_type: Platform,
    pub event_type: MonitoredServerEventType,
    pub occurred_at: DateTime<Utc>,
}
