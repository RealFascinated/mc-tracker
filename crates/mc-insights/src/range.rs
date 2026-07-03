use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};

use mc_metrics::{max_span, min_span};

use crate::error::InsightsError;
use crate::traits::{ResolvedTimeRange, TimeRangeParser};

const DAY_SECONDS: i64 = 86_400;

pub struct DefaultTimeRangeParser;

impl TimeRangeParser for DefaultTimeRangeParser {
    fn parse(&self, from: &str, to: &str, now: i64) -> Result<ResolvedTimeRange, InsightsError> {
        let to_epoch = parse_bound(to, now, true)?;
        let from_epoch = parse_bound(from, now, false)?;
        if from_epoch >= to_epoch {
            return Err(InsightsError::InvalidRange("from must be before to".into()));
        }
        let span = to_epoch - from_epoch;
        let min_secs = min_span().as_secs() as i64;
        let max_secs = max_span().as_secs() as i64;
        if span < min_secs {
            return Err(InsightsError::InvalidRange(format!(
                "span must be at least {min_secs} seconds"
            )));
        }
        if span > max_secs {
            return Err(InsightsError::InvalidRange(format!(
                "span must be at most {max_secs} seconds"
            )));
        }
        Ok(ResolvedTimeRange {
            from: from_epoch,
            to: to_epoch,
        })
    }
}

fn parse_bound(input: &str, now: i64, is_to: bool) -> Result<i64, InsightsError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(InsightsError::InvalidRange("empty bound".into()));
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower == "now" {
        return Ok(now);
    }
    if let Some(rest) = lower.strip_suffix('d') {
        if let Ok(days) = rest.parse::<i64>() {
            let offset = days * DAY_SECONDS;
            return Ok(if is_to { now } else { now - offset });
        }
    }
    if lower == "this month" {
        let dt = Utc
            .timestamp_opt(now, 0)
            .single()
            .ok_or_else(|| InsightsError::InvalidRange("invalid now timestamp".into()))?;
        let start = month_start(dt);
        return Ok(if is_to { now } else { start });
    }
    if let Ok(epoch) = trimmed.parse::<i64>() {
        return Ok(epoch);
    }
    if let Ok(date) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        let dt = date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| InsightsError::InvalidRange("invalid date".into()))?;
        return Ok(dt.and_utc().timestamp());
    }
    Err(InsightsError::InvalidRange(format!(
        "unrecognized bound: {input}"
    )))
}

fn month_start(dt: DateTime<Utc>) -> i64 {
    let naive = NaiveDate::from_ymd_opt(dt.year(), dt.month(), 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    naive.and_utc().timestamp()
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_710_000_000;

    #[test]
    fn parse_seven_days() {
        let parser = DefaultTimeRangeParser;
        let range = parser.parse("7d", "now", NOW).unwrap();
        assert_eq!(range.to, NOW);
        assert_eq!(range.from, NOW - 7 * DAY_SECONDS);
    }

    #[test]
    fn parse_unix() {
        let parser = DefaultTimeRangeParser;
        let range = parser.parse("1700000000", "1710000000", NOW).unwrap();
        assert_eq!(range.from, 1_700_000_000);
        assert_eq!(range.to, 1_710_000_000);
    }

    #[test]
    fn rejects_inverted() {
        let parser = DefaultTimeRangeParser;
        assert!(parser.parse("now", "7d", NOW).is_err());
    }
}
