use std::time::Duration;

const MAX_POINTS: u64 = 800;
const MIN_STEP: Duration = Duration::from_secs(15);
const MIN_SPAN: Duration = Duration::from_secs(5 * 60);
const MAX_SPAN: Duration = Duration::from_secs(730 * 24 * 60 * 60);
const NICE_STEP_SECONDS: [u64; 12] = [
    15, 30, 60, 120, 300, 900, 1800, 3600, 7200, 21600, 86400, 172800,
];

pub fn min_span() -> Duration {
    MIN_SPAN
}

pub fn max_span() -> Duration {
    MAX_SPAN
}

pub fn max_points() -> u64 {
    MAX_POINTS
}

pub fn min_step() -> Duration {
    MIN_STEP
}

pub fn step_for(span: Duration) -> Duration {
    let target_step = span.as_secs().max(MIN_STEP.as_secs()) / MAX_POINTS;
    for &nice in &NICE_STEP_SECONDS {
        if nice >= target_step {
            return Duration::from_secs(nice);
        }
    }
    Duration::from_secs(*NICE_STEP_SECONDS.last().unwrap())
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use mc_common::constants::time::SECONDS_PER_DAY_U64;

    use super::*;

    #[test]
    fn step_for_one_hour_returns_15_seconds() {
        assert_eq!(step_for(Duration::from_secs(3600)), min_step());
    }

    #[test]
    fn step_for_seven_days_returns_15_minutes() {
        assert_eq!(
            step_for(Duration::from_secs(7 * 24 * 60 * 60)),
            Duration::from_secs(900)
        );
    }

    #[test]
    fn step_for_one_year_returns_one_day() {
        assert_eq!(
            step_for(Duration::from_secs(365 * 24 * 60 * 60)),
            Duration::from_secs(SECONDS_PER_DAY_U64)
        );
    }

    #[test]
    fn step_for_boundary_snaps_to_nice_interval() {
        let span = Duration::from_secs(400 * 60);
        assert_eq!(step_for(span), Duration::from_secs(30));
    }

    /// Port of Server Monitor `MetricStepPolicyTest` table cases.
    #[test]
    fn step_for_metric_step_policy_table() {
        let cases = [
            (Duration::from_secs(3600), 15),
            (Duration::from_secs(6 * 3600), 30),
            (Duration::from_secs(24 * 3600), 120),
            (Duration::from_secs(7 * 24 * 3600), 900),
            (Duration::from_secs(30 * 24 * 3600), 3600),
            (Duration::from_secs(365 * 24 * 3600), SECONDS_PER_DAY_U64),
        ];

        for (span, expected_step_secs) in cases {
            assert_eq!(
                step_for(span),
                Duration::from_secs(expected_step_secs),
                "span={span:?}"
            );
        }
    }

    #[test]
    fn step_for_max_span_uses_largest_nice_interval() {
        assert_eq!(
            step_for(max_span()),
            Duration::from_secs(SECONDS_PER_DAY_U64)
        );
    }
}
