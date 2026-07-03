use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PinnedServer {
    pub id: Uuid,
    pub user_id: Uuid,
    pub server_id: Uuid,
    pub position: i32,
}
