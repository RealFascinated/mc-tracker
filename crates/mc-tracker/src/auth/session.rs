use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use hmac::{Hmac, Mac};
use mc_db::model::UserRole;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tokio::sync::RwLock;
use uuid::Uuid;

pub const COOKIE_NAME: &str = "mc_tracker_session";
pub const MAX_AGE_SECS: i64 = 7 * 24 * 60 * 60;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct SessionClaims {
    pub sub: Uuid,
    pub username: String,
    pub role: String,
    pub iat: i64,
}

#[derive(Clone)]
pub struct SessionManager {
    secret: Arc<Vec<u8>>,
    secure_cookies: bool,
    revoked: Arc<RwLock<HashSet<String>>>,
}

impl SessionManager {
    pub fn new(secret: impl Into<Vec<u8>>, secure_cookies: bool) -> Self {
        Self {
            secret: Arc::new(secret.into()),
            secure_cookies,
            revoked: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    pub(crate) fn issue_token(
        &self,
        user_id: Uuid,
        username: &str,
        role: UserRole,
    ) -> Result<String, SessionError> {
        let claims = SessionClaims {
            sub: user_id,
            username: username.to_string(),
            role: role.as_str().to_string(),
            iat: now_epoch_secs(),
        };
        self.sign_claims(&claims)
    }

    #[cfg(test)]
    pub(crate) fn issue_token_with_iat(
        &self,
        user_id: Uuid,
        username: &str,
        role: UserRole,
        iat: i64,
    ) -> Result<String, SessionError> {
        let claims = SessionClaims {
            sub: user_id,
            username: username.to_string(),
            role: role.as_str().to_string(),
            iat,
        };
        self.sign_claims(&claims)
    }

    pub(crate) async fn validate_token(&self, token: &str) -> Result<SessionClaims, SessionError> {
        let claims = self.verify_and_parse(token)?;
        if self.revoked.read().await.contains(token) {
            return Err(SessionError::Revoked);
        }
        let age = now_epoch_secs().saturating_sub(claims.iat);
        if age > MAX_AGE_SECS {
            return Err(SessionError::Expired);
        }
        Ok(claims)
    }

    pub async fn revoke_token(&self, token: &str) {
        self.revoked.write().await.insert(token.to_string());
    }

    pub fn cookie_value(&self, token: &str) -> String {
        let mut value = format!(
            "{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={MAX_AGE_SECS}"
        );
        if self.secure_cookies {
            value.push_str("; Secure");
        }
        value
    }

    pub fn clear_cookie_value(&self) -> String {
        let mut value = format!("{COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
        if self.secure_cookies {
            value.push_str("; Secure");
        }
        value
    }

    fn sign_claims(&self, claims: &SessionClaims) -> Result<String, SessionError> {
        let payload = serde_json::to_vec(claims).map_err(|_| SessionError::Invalid)?;
        let encoded = URL_SAFE_NO_PAD.encode(payload);
        let signature = sign_bytes(&self.secret, encoded.as_bytes())?;
        Ok(format!("{encoded}.{signature}"))
    }

    fn verify_and_parse(&self, token: &str) -> Result<SessionClaims, SessionError> {
        let (encoded, signature) = token.split_once('.').ok_or(SessionError::Invalid)?;
        let expected = sign_bytes(&self.secret, encoded.as_bytes())?;
        if !constant_time_eq(signature.as_bytes(), expected.as_bytes()) {
            return Err(SessionError::Invalid);
        }
        let payload = URL_SAFE_NO_PAD
            .decode(encoded)
            .map_err(|_| SessionError::Invalid)?;
        serde_json::from_slice(&payload).map_err(|_| SessionError::Invalid)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionError {
    Invalid,
    Expired,
    Revoked,
}

fn sign_bytes(secret: &[u8], data: &[u8]) -> Result<String, SessionError> {
    let mut mac = HmacSha256::new_from_slice(secret).map_err(|_| SessionError::Invalid)?;
    mac.update(data);
    Ok(URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes()))
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

fn now_epoch_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn issue_and_validate_round_trip() {
        let manager = SessionManager::new(b"test-secret", false);
        let id = Uuid::new_v4();
        let token = manager.issue_token(id, "admin", UserRole::Admin).unwrap();
        let claims = manager.validate_token(&token).await.unwrap();
        assert_eq!(claims.sub, id);
        assert_eq!(claims.username, "admin");
        assert_eq!(claims.role, "admin");
    }

    #[tokio::test]
    async fn revoked_token_is_rejected() {
        let manager = SessionManager::new(b"test-secret", false);
        let token = manager
            .issue_token(Uuid::new_v4(), "admin", UserRole::Admin)
            .unwrap();
        manager.revoke_token(&token).await;
        assert_eq!(
            manager.validate_token(&token).await.unwrap_err(),
            SessionError::Revoked
        );
    }

    #[tokio::test]
    async fn expired_token_is_rejected() {
        let manager = SessionManager::new(b"test-secret", false);
        let expired_iat = now_epoch_secs() - MAX_AGE_SECS - 1;
        let token = manager
            .issue_token_with_iat(Uuid::new_v4(), "admin", UserRole::Admin, expired_iat)
            .unwrap();
        assert_eq!(
            manager.validate_token(&token).await.unwrap_err(),
            SessionError::Expired
        );
    }

    #[tokio::test]
    async fn tampered_token_is_rejected() {
        let manager = SessionManager::new(b"test-secret", false);
        let token = manager
            .issue_token(Uuid::new_v4(), "admin", UserRole::Admin)
            .unwrap();
        let tampered = format!("{token}x");
        assert_eq!(
            manager.validate_token(&tampered).await.unwrap_err(),
            SessionError::Invalid
        );
    }

    #[test]
    fn cookie_value_sets_security_flags() {
        let manager = SessionManager::new(b"test-secret", true);
        let cookie = manager.cookie_value("token-value");
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.starts_with("mc_tracker_session=token-value"));
    }
}
