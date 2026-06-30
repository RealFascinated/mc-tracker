use std::future::Future;
use std::time::Duration;

use tokio::time::sleep;

use crate::error::PingError;

pub async fn with_retry<T, F, Fut>(
    attempts: u32,
    delay_ms: u64,
    hostname: &str,
    mut operation: F,
) -> Result<T, PingError>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, PingError>>,
{
    let attempts = attempts.max(1);
    let mut last_err = None;

    for attempt in 0..attempts {
        match operation().await {
            Ok(value) => return Ok(value),
            Err(err) => {
                last_err = Some(err);
                if attempt + 1 < attempts {
                    sleep(Duration::from_millis(delay_ms)).await;
                }
            }
        }
    }

    if let Some(err) = last_err {
        return Err(err);
    }
    Err(PingError::AttemptsExhausted(hostname.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[tokio::test]
    async fn succeeds_after_retries() {
        let calls = AtomicU32::new(0);
        let result = with_retry(3, 1, "host", || {
            let calls = &calls;
            async move {
                let n = calls.fetch_add(1, Ordering::SeqCst) + 1;
                if n < 3 {
                    Err(PingError::NoResponse("host".into()))
                } else {
                    Ok(42)
                }
            }
        })
        .await
        .unwrap();
        assert_eq!(result, 42);
        assert_eq!(calls.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn exhausts_attempts() {
        let err = with_retry::<(), _, _>(2, 1, "host", || async {
            Err(PingError::NoResponse("host".into()))
        })
        .await
        .unwrap_err();
        assert!(matches!(err, PingError::NoResponse(_)));
    }
}
