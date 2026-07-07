use std::time::Duration;

use crate::metric::error::MetricsError;
use crate::metric::query::query_window::MetricQueryWindow;
use crate::metric::query::vm_query::VmQueryBuilder;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VmRangeQuery {
    promql: String,
    window: MetricQueryWindow,
}

impl VmRangeQuery {
    pub fn builder() -> VmRangeQueryBuilder {
        VmRangeQueryBuilder::default()
    }

    pub fn window(&self) -> &MetricQueryWindow {
        &self.window
    }

    pub fn to_vm_query(&self) -> Result<crate::metric::query::VmQuery, MetricsError> {
        VmQueryBuilder::default()
            .query(&self.promql)
            .from(self.window.vm_query_from())
            .to(self.window.vm_query_to())
            .step(self.window.step())
            .build()
    }
}

#[derive(Default)]
pub struct VmRangeQueryBuilder {
    promql: Option<String>,
    from_epoch: Option<i64>,
    to_epoch: Option<i64>,
    step: Option<Duration>,
    chart_step: bool,
}

impl VmRangeQueryBuilder {
    pub fn promql(mut self, promql: impl Into<String>) -> Self {
        self.promql = Some(promql.into());
        self
    }

    pub fn from_epoch(mut self, from: i64) -> Self {
        self.from_epoch = Some(from);
        self
    }

    pub fn to_epoch(mut self, to: i64) -> Self {
        self.to_epoch = Some(to);
        self
    }

    pub fn chart_step(mut self) -> Self {
        self.chart_step = true;
        self.step = None;
        self
    }

    pub fn step(mut self, step: Duration) -> Self {
        self.chart_step = false;
        self.step = Some(step);
        self
    }

    pub fn build(self) -> Result<VmRangeQuery, MetricsError> {
        let promql = self
            .promql
            .filter(|q| !q.is_empty())
            .ok_or_else(|| MetricsError::InvalidWindow("query requires promql".into()))?;

        let from_epoch = self
            .from_epoch
            .ok_or_else(|| MetricsError::InvalidWindow("query requires from epoch".into()))?;
        let to_epoch = self
            .to_epoch
            .ok_or_else(|| MetricsError::InvalidWindow("query requires to epoch".into()))?;

        let window = if self.chart_step {
            MetricQueryWindow::parse(from_epoch, to_epoch)?
        } else {
            let step = self
                .step
                .ok_or_else(|| MetricsError::InvalidWindow("query requires step".into()))?;
            MetricQueryWindow::parse_with_step(from_epoch, to_epoch, step)?
        };

        Ok(VmRangeQuery { promql, window })
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use mc_common::constants::time::SECONDS_PER_DAY;

    use super::*;
    use crate::metric::query::step_policy;

    #[test]
    fn build_chart_step_uses_policy() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 3600;
        let query = VmRangeQuery::builder()
            .promql("up")
            .from_epoch(from)
            .to_epoch(to)
            .chart_step()
            .build()
            .unwrap();
        assert_eq!(query.window().step(), step_policy::min_step());
    }

    #[test]
    fn build_explicit_step() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let from = to - 30 * SECONDS_PER_DAY;
        let step = Duration::from_secs(SECONDS_PER_DAY as u64);
        let query = VmRangeQuery::builder()
            .promql("up")
            .from_epoch(from)
            .to_epoch(to)
            .step(step)
            .build()
            .unwrap();
        assert_eq!(query.window().step(), step);
    }

    #[test]
    fn build_rejects_missing_promql() {
        let to = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let err = VmRangeQuery::builder()
            .from_epoch(to - 3600)
            .to_epoch(to)
            .chart_step()
            .build()
            .unwrap_err();
        assert!(matches!(err, MetricsError::InvalidWindow(_)));
    }
}
