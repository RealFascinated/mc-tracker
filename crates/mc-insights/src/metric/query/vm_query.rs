use std::time::{Duration, SystemTime};

use crate::metric::error::MetricsError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VmQuery {
    promql: String,
    from: Option<SystemTime>,
    to: Option<SystemTime>,
    step: Option<Duration>,
    at: Option<SystemTime>,
}

impl VmQuery {
    pub fn promql(&self) -> &str {
        &self.promql
    }

    pub fn is_range(&self) -> bool {
        self.from.is_some() && self.to.is_some()
    }

    pub fn from(&self) -> Option<SystemTime> {
        self.from
    }

    pub fn to(&self) -> Option<SystemTime> {
        self.to
    }

    pub fn at(&self) -> Option<SystemTime> {
        self.at
    }

    pub fn step_param(&self) -> Result<String, MetricsError> {
        let step = self
            .step
            .ok_or_else(|| MetricsError::InvalidWindow("range query requires step".into()))?;
        Ok(format_step(step))
    }
}

#[derive(Default)]
pub struct VmQueryBuilder {
    promql: Option<String>,
    from: Option<SystemTime>,
    to: Option<SystemTime>,
    step: Option<Duration>,
    at: Option<SystemTime>,
}

impl VmQueryBuilder {
    pub fn query(mut self, promql: impl Into<String>) -> Self {
        self.promql = Some(promql.into());
        self
    }

    pub fn from(mut self, from: SystemTime) -> Self {
        self.from = Some(from);
        self
    }

    pub fn to(mut self, to: SystemTime) -> Self {
        self.to = Some(to);
        self
    }

    pub fn step(mut self, step: Duration) -> Self {
        self.step = Some(step);
        self
    }

    #[cfg(test)]
    pub fn at(mut self, at: SystemTime) -> Self {
        self.at = Some(at);
        self
    }

    pub fn build(self) -> Result<VmQuery, MetricsError> {
        let promql = self
            .promql
            .filter(|q| !q.is_empty())
            .ok_or_else(|| MetricsError::InvalidWindow("query requires promql".into()))?;

        let has_from = self.from.is_some();
        let has_to = self.to.is_some();
        if has_from != has_to {
            return Err(MetricsError::InvalidWindow(
                "range queries require both from and to".into(),
            ));
        }

        if has_from {
            let from = self.from.unwrap();
            let to = self.to.unwrap();
            let step = self.step.ok_or_else(|| {
                MetricsError::InvalidWindow("range queries require a positive step".into())
            })?;
            if step.is_zero() {
                return Err(MetricsError::InvalidWindow(
                    "range queries require a positive step".into(),
                ));
            }
            if from >= to {
                return Err(MetricsError::InvalidWindow("from must be before to".into()));
            }
            return Ok(VmQuery {
                promql,
                from: Some(from),
                to: Some(to),
                step: Some(step),
                at: None,
            });
        }

        Ok(VmQuery {
            promql,
            from: None,
            to: None,
            step: None,
            at: Some(self.at.unwrap_or_else(SystemTime::now)),
        })
    }
}

pub fn format_step(duration: Duration) -> String {
    let seconds = duration.as_secs();
    if seconds >= 3600 && seconds.is_multiple_of(3600) {
        return format!("{}h", seconds / 3600);
    }
    if seconds >= 60 && seconds.is_multiple_of(60) {
        return format!("{}m", seconds / 60);
    }
    format!("{seconds}s")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_step_uses_human_suffixes() {
        assert_eq!(format_step(Duration::from_secs(15)), "15s");
        assert_eq!(format_step(Duration::from_secs(1800)), "30m");
        assert_eq!(format_step(Duration::from_secs(86400)), "24h");
    }
}
