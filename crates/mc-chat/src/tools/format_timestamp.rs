use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::{json, Value};

use crate::error::ChatError;
use crate::tools::helpers::tool_def;
use crate::traits::{ChatTool, ChatToolDeps};

pub struct FormatTimestampTool;

#[async_trait]
impl ChatTool for FormatTimestampTool {
    fn name(&self) -> &'static str {
        "format_timestamp"
    }

    fn definition(&self) -> crate::llm::types::ToolDefinition {
        tool_def(
            "format_timestamp",
            "Convert a timestamp (unix epoch seconds/milliseconds or ISO 8601 string) to formatted UTC dates.",
            json!({
                "type": "object",
                "properties": {
                    "timestamp": {
                        "type": ["string", "number"],
                        "description": "Unix epoch (seconds or milliseconds) or ISO 8601 / RFC 3339 string"
                    }
                },
                "required": ["timestamp"]
            }),
        )
    }

    async fn execute(
        &self,
        _deps: &ChatToolDeps,
        args: Value,
    ) -> Result<Value, ChatError> {
        let value = args
            .get("timestamp")
            .ok_or_else(|| ChatError::Tool("timestamp required".into()))?;
        let dt = parse_timestamp(value)?;
        Ok(json!({
            "epoch": dt.timestamp(),
            "iso": dt.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            "date": dt.format("%Y-%m-%d").to_string(),
            "time": dt.format("%H:%M:%S").to_string(),
            "human": dt.format("%d %b %Y, %H:%M UTC").to_string(),
        }))
    }
}

fn parse_timestamp(value: &Value) -> Result<DateTime<Utc>, ChatError> {
    let invalid = || ChatError::Tool(format!("invalid timestamp: {value}"));
    match value {
        Value::Number(n) => from_epoch(n.as_i64().ok_or_else(invalid)?),
        Value::String(s) => {
            let s = s.trim();
            if s.is_empty() {
                Err(invalid())
            } else if s.chars().all(|c| c.is_ascii_digit()) {
                from_epoch(s.parse::<i64>().map_err(|_| invalid())?)
            } else {
                Ok(DateTime::parse_from_rfc3339(s)
                    .map_err(|_| invalid())?
                    .with_timezone(&Utc))
            }
        }
        _ => Err(invalid()),
    }
}

fn from_epoch(v: i64) -> Result<DateTime<Utc>, ChatError> {
    // Epoch values with magnitude >= 1e12 are milliseconds, otherwise seconds.
    let is_millis = v >= 1_000_000_000_000 || v <= -1_000_000_000_000;
    let dt = if is_millis {
        DateTime::from_timestamp_millis(v)
    } else {
        DateTime::from_timestamp(v, 0)
    };
    dt.ok_or_else(|| ChatError::Tool(format!("invalid timestamp: {v}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_epoch_seconds() {
        let dt = parse_timestamp(&json!(1_700_000_000)).unwrap();
        assert_eq!(dt.format("%Y-%m-%dT%H:%M:%SZ").to_string(), "2023-11-14T22:13:20Z");
    }

    #[test]
    fn parses_epoch_millis() {
        let dt = parse_timestamp(&json!(1_700_000_000_000i64)).unwrap();
        assert_eq!(dt.format("%Y-%m-%dT%H:%M:%SZ").to_string(), "2023-11-14T22:13:20Z");
    }

    #[test]
    fn parses_numeric_string() {
        let dt = parse_timestamp(&json!("1700000000")).unwrap();
        assert_eq!(dt.timestamp(), 1_700_000_000);
    }

    #[test]
    fn parses_iso8601() {
        let dt = parse_timestamp(&json!("2026-08-26T23:06:00Z")).unwrap();
        assert_eq!(dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2026-08-26 23:06:00");
    }

    #[test]
    fn converts_rfc3339_offset_to_utc() {
        let dt = parse_timestamp(&json!("2026-08-26T23:06:00+02:00")).unwrap();
        assert_eq!(dt.format("%H:%M:%S").to_string(), "21:06:00");
    }

    #[test]
    fn rejects_invalid_timestamps() {
        assert!(parse_timestamp(&json!("not a date")).is_err());
        assert!(parse_timestamp(&json!("")).is_err());
        assert!(parse_timestamp(&json!(true)).is_err());
        assert!(parse_timestamp(&json!(null)).is_err());
    }
}
