use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApiErrorCode {
    InvalidRange,
    NoData,
    ServerNotFound,
    AsnNotFound,
    NotFound,
    BadRequest,
    Unauthorized,
    Forbidden,
    Conflict,
    TooManyRequests,
    InternalError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: ApiErrorCode,
    pub message: String,
}

impl ApiError {
    pub fn new(code: ApiErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ErrorTarget {
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
pub struct PartialError {
    pub code: ApiErrorCode,
    pub message: String,
    pub target: ErrorTarget,
}

impl PartialError {
    pub fn new(code: ApiErrorCode, message: impl Into<String>, target: ErrorTarget) -> Self {
        Self {
            code,
            message: message.into(),
            target,
        }
    }
}
