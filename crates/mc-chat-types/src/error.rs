use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChatErrorCode {
    InvalidRange,
    NoData,
    ServerNotFound,
    AsnNotFound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatErrorTarget {
    Server {
        id: String,
    },
    Asn {
        asn: String,
        #[serde(rename = "asnOrg")]
        asn_org: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatPartialError {
    pub code: ChatErrorCode,
    pub message: String,
    pub target: ChatErrorTarget,
}

impl ChatPartialError {
    pub fn new(code: ChatErrorCode, message: impl Into<String>, target: ChatErrorTarget) -> Self {
        Self {
            code,
            message: message.into(),
            target,
        }
    }
}
