use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use mc_api_types::{ApiError, ApiErrorCode};
use tokio::sync::Mutex;

const MAX_ATTEMPTS: usize = 10;
const WINDOW: Duration = Duration::from_secs(5 * 60);

/// Client IP from Cloudflare (`CF-Connecting-IP`), or loopback when absent (local dev).
pub fn client_ip_from_headers(headers: &HeaderMap) -> IpAddr {
    headers
        .get("cf-connecting-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(IpAddr::V4(std::net::Ipv4Addr::LOCALHOST))
}

#[derive(Default)]
pub struct LoginRateLimiter {
    attempts: Mutex<HashMap<IpAddr, Vec<Instant>>>,
}

impl LoginRateLimiter {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub async fn check(&self, ip: IpAddr) -> Result<(), Response> {
        let mut attempts = self.attempts.lock().await;
        let now = Instant::now();
        let entry = attempts.entry(ip).or_default();
        entry.retain(|instant| now.duration_since(*instant) < WINDOW);
        if entry.len() >= MAX_ATTEMPTS {
            return Err(rate_limited_response());
        }
        entry.push(now);
        Ok(())
    }
}

fn rate_limited_response() -> Response {
    let retry_after = HeaderValue::from_static("300");
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(axum::http::header::RETRY_AFTER, retry_after)],
        axum::Json(ApiError::new(
            ApiErrorCode::TooManyRequests,
            "too many login attempts",
        )),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn client_ip_uses_cf_connecting_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("cf-connecting-ip", HeaderValue::from_static("203.0.113.7"));
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("10.0.0.1, 192.0.2.1"),
        );
        assert_eq!(
            client_ip_from_headers(&headers),
            IpAddr::V4(Ipv4Addr::new(203, 0, 113, 7))
        );
    }

    #[test]
    fn client_ip_falls_back_to_loopback_without_cf_header() {
        let headers = HeaderMap::new();
        assert_eq!(
            client_ip_from_headers(&headers),
            IpAddr::V4(Ipv4Addr::LOCALHOST)
        );
    }

    #[tokio::test]
    async fn blocks_after_ten_attempts() {
        let limiter = LoginRateLimiter::new();
        let ip = IpAddr::V4(Ipv4Addr::LOCALHOST);
        for _ in 0..10 {
            limiter.check(ip).await.unwrap();
        }
        assert!(limiter.check(ip).await.is_err());
    }
}
