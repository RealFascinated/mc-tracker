use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: &'static str,
    pub db: bool,
    pub maxmind: bool,
}

impl HealthResponse {
    pub fn ok(db: bool, maxmind: bool) -> Self {
        Self {
            status: "ok",
            db,
            maxmind,
        }
    }
}
