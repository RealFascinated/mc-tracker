use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchUserFlagsRequest {
    pub flags: i64,
}
