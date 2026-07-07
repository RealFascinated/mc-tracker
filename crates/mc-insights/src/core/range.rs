use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};

use mc_common::constants::time::SECONDS_PER_DAY;

use crate::error::InsightsError;
use crate::metric::{max_span, MetricQueryWindow};

const CHAT_MIN_SPAN_DAYS: i64 = 7;
const CHAT_MIN_SPAN_SECS: i64 = CHAT_MIN_SPAN_DAYS * SECONDS_PER_DAY;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedTimeRange {
    pub from: i64,
    pub to: i64,
}

pub fn parse_chart_epochs(from: i64, to: i64) -> Result<ResolvedTimeRange, InsightsError> {
    MetricQueryWindow::parse(from, to)?;
    Ok(ResolvedTimeRange { from, to })
}

pub fn parse_insights_range(from: &str, to: &str, now: i64) -> Result<ResolvedTimeRange, InsightsError> {
    let to_epoch = parse_bound(to, now, true)?;
    let from_epoch = parse_bound(from, now, false)?;
    if from_epoch >= to_epoch {
        return Err(InsightsError::InvalidRange("from must be before to".into()));
    }
    let span = to_epoch - from_epoch;
    if span < CHAT_MIN_SPAN_SECS {
        return Err(InsightsError::InvalidRange(format!(
            "span must be at least {CHAT_MIN_SPAN_DAYS} days"
        )));
    }
    let max_secs = max_span().as_secs() as i64;
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
            let offset = days * SECONDS_PER_DAY;
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
        let range = parse_insights_range("7d", "now", NOW).unwrap();
        assert_eq!(range.to, NOW);
        assert_eq!(range.from, NOW - 7 * SECONDS_PER_DAY);
    }

    #[test]
    fn rejects_shorter_than_seven_days() {
        assert!(parse_insights_range("2d", "now", NOW).is_err());
    }
}
