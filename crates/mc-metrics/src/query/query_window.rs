use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::error::MetricsError;
use crate::query::step_policy;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetricQueryWindow {
    from: SystemTime,
    to: SystemTime,
    step: Duration,
}

impl MetricQueryWindow {
    pub fn parse(from_epoch: i64, to_epoch: i64) -> Result<Self, MetricsError> {
        let from = unix_epoch(from_epoch)?;
        let to = unix_epoch(to_epoch)?;
        let now = SystemTime::now();
        let clamped_to = if to > now { now } else { to };

        if from >= clamped_to {
            return Err(MetricsError::InvalidWindow("from must be before to".into()));
        }

        let span = clamped_to
            .duration_since(from)
            .map_err(|_| MetricsError::InvalidWindow("invalid span".into()))?;

        if span < step_policy::min_span() {
            return Err(MetricsError::InvalidWindow(
                "metric window must be at least 5 minutes".into(),
            ));
        }
        if span > step_policy::max_span() {
            return Err(MetricsError::InvalidWindow(
                "metric window must be at most 2 years".into(),
            ));
        }

        Ok(Self {
            from,
            to: clamped_to,
            step: step_policy::step_for(span),
        })
    }

    pub fn from(&self) -> SystemTime {
        self.from
    }

    pub fn to(&self) -> SystemTime {
        self.to
    }

    pub fn step(&self) -> Duration {
        self.step
    }

    pub fn from_epoch(&self) -> i64 {
        self.from
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    pub fn to_epoch(&self) -> i64 {
        self.to
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    pub fn step_seconds(&self) -> i64 {
        self.step.as_secs() as i64
    }

    /// Range-query start for VictoriaMetrics.
    pub fn vm_query_from(&self) -> SystemTime {
        self.from
    }

    pub fn vm_query_to(&self) -> SystemTime {
        self.to
    }

    pub fn point_count(&self) -> u64 {
        let span_secs = self
            .to
            .duration_since(self.from)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        span_secs / self.step.as_secs().max(1) + 1
    }
}

fn unix_epoch(seconds: i64) -> Result<SystemTime, MetricsError> {
    if seconds < 0 {
        return Err(MetricsError::InvalidWindow(
            "epoch must be non-negative".into(),
        ));
    }
    Ok(UNIX_EPOCH + Duration::from_secs(seconds as u64))
}

#[cfg(test)]
mod tests {
    use mc_common::constants::time::SECONDS_PER_DAY;

    use super::*;

    #[test]
    fn parse_rejects_span_shorter_than_five_minutes() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let min_span_secs = step_policy::min_span().as_secs() as i64;
        let from = to - (min_span_secs - 60);
        assert!(MetricQueryWindow::parse(from, to).is_err());
    }

    #[test]
    fn parse_rejects_span_longer_than_two_years() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let max_span_secs = step_policy::max_span().as_secs() as i64;
        let from = to - (max_span_secs + SECONDS_PER_DAY);
        assert!(MetricQueryWindow::parse(from, to).is_err());
    }

    #[test]
    fn parse_clamps_future_to() {
        let from = (SystemTime::now() - Duration::from_secs(3600))
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let to = (SystemTime::now() + Duration::from_secs(3600))
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let window = MetricQueryWindow::parse(from, to).unwrap();
        assert_eq!(window.step(), step_policy::min_step());
        assert!(window.to() <= SystemTime::now());
    }

    #[test]
    fn point_count_stays_within_max_for_one_hour() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 3600;
        let window = MetricQueryWindow::parse(from, to).unwrap();
        assert!(window.point_count() <= step_policy::max_points());
    }

    #[test]
    fn parse_rejects_from_greater_than_or_equal_to_to() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        assert!(MetricQueryWindow::parse(to, to).is_err());
        assert!(MetricQueryWindow::parse(to + 60, to).is_err());
    }

    #[test]
    fn point_count_stays_within_max_for_policy_table_spans() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let max_span_secs = step_policy::max_span().as_secs();
        let spans_secs: [i64; 8] = [
            step_policy::min_span().as_secs() as i64,
            3600,
            6 * 3600,
            24 * 3600,
            7 * 24 * 3600,
            30 * 24 * 3600,
            365 * 24 * 3600,
            max_span_secs as i64 - 60,
        ];

        for span in spans_secs {
            let from = to - span;
            let window = MetricQueryWindow::parse(from, to)
                .unwrap_or_else(|err| panic!("span {span}s should be valid: {err}"));
            assert!(
                window.point_count() <= step_policy::max_points(),
                "span={span}s step={}s points={}",
                window.step_seconds(),
                window.point_count()
            );
        }
    }
}
