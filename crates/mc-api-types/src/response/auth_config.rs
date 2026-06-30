use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignupEnabledResponse {
    pub sign_up_enabled: bool,
}
