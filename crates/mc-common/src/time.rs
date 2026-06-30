use std::time::{SystemTime, UNIX_EPOCH};

/// Current Unix time in milliseconds (`u64`).
pub fn unix_now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Current Unix time in milliseconds (`i64`) — used for `Ping.timestamp` and similar fields.
pub fn now_ms() -> i64 {
    unix_now_ms() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_ms_matches_unix_now_ms() {
        let unix = unix_now_ms();
        let signed = now_ms();
        assert_eq!(signed, unix as i64);
        assert!(unix > 1_700_000_000_000);
    }
}
