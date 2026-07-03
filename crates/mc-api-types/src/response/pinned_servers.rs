use serde::Serialize;

use super::servers::ServerListItemResponse;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedServersListResponse {
    pub servers: Vec<ServerListItemResponse>,
}
