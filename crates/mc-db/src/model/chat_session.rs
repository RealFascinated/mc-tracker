use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ChatSessionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ChatTurnRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub seq: i32,
    pub role: String,
    pub content: String,
    pub tool_names: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ChatSessionSummary {
    pub id: Uuid,
    pub updated_at: DateTime<Utc>,
    pub preview: String,
    pub turn_count: i64,
}
