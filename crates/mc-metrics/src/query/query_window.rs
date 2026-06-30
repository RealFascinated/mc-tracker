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
        return Err(MetricsError::InvalidWindow("epoch must be non-negative".into()));
    }
    Ok(UNIX_EPOCH + Duration::from_secs(seconds as u64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rejects_span_shorter_than_five_minutes() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 4 * 60;
        assert!(MetricQueryWindow::parse(from, to).is_err());
    }

    #[test]
    fn parse_rejects_span_longer_than_two_years() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 731 * 24 * 60 * 60;
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
        assert_eq!(window.step(), Duration::from_secs(15));
        assert!(window.to() <= SystemTime::now());
    }

    #[test]
    fn point_count_stays_within_400_for_one_hour() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 3600;
        let window = MetricQueryWindow::parse(from, to).unwrap();
        assert!(window.point_count() <= 400);
    }
}
