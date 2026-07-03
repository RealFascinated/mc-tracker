use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUser {
    pub id: String,
    pub username: String,
    pub role: String,
    pub flags: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUsersListResponse {
    pub users: Vec<AdminUser>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchUserFlagsResponse {
    pub id: String,
    pub flags: i64,
}
