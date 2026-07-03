use std::collections::BTreeMap;

use crate::query::MetricQueryWindow;

#[derive(Debug, Default)]
struct BucketAverage {
    sum: f64,
    count: u64,
}

impl BucketAverage {
    fn add(&mut self, value: f64) {
        self.sum += value;
        self.count += 1;
    }

    fn average(self) -> Option<f64> {
        (self.count > 0).then_some(self.sum / self.count as f64)
    }
}

/// Expand sparse VictoriaMetrics samples onto the query window grid (at most [`max_points`]).
pub fn align_samples_to_window(
    window: &MetricQueryWindow,
    samples: &[(i64, Option<f64>)],
) -> (Vec<i64>, Vec<Option<f64>>) {
    align_samples_to_window_with(window, samples, BucketReducer::Max)
}

/// Like [`align_samples_to_window`], but averages multiple samples that fall in the same bucket.
pub fn align_samples_to_window_avg(
    window: &MetricQueryWindow,
    samples: &[(i64, Option<f64>)],
) -> (Vec<i64>, Vec<Option<f64>>) {
    align_samples_to_window_with(window, samples, BucketReducer::Average)
}

#[derive(Clone, Copy)]
enum BucketReducer {
    Max,
    Average,
}

fn align_samples_to_window_with(
    window: &MetricQueryWindow,
    samples: &[(i64, Option<f64>)],
    reducer: BucketReducer,
) -> (Vec<i64>, Vec<Option<f64>>) {
    let step = window.step_seconds().max(1);
    let from = window.from_epoch();
    let to = window.to_epoch();
    let start = (from / step) * step;

    let mut buckets: BTreeMap<i64, Option<f64>> = BTreeMap::new();
    let mut timestamp = start;
    while timestamp <= to {
        buckets.insert(timestamp, None);
        timestamp += step;
    }

    let mut averages: BTreeMap<i64, BucketAverage> = BTreeMap::new();

    for (sample_ts, value) in samples {
        let Some(value) = *value else {
            continue;
        };
        let bucket_ts = if step == 86_400 {
            (*sample_ts / step) * step
        } else {
            let index = (*sample_ts - start) / step;
            start + index * step
        };
        if bucket_ts < start || bucket_ts > to {
            continue;
        }

        match reducer {
            BucketReducer::Max => {
                buckets
                    .entry(bucket_ts)
                    .and_modify(|current| {
                        *current = Some(match current {
                            Some(existing) => existing.max(value),
                            None => value,
                        });
                    })
                    .or_insert(Some(value));
            }
            BucketReducer::Average => {
                averages.entry(bucket_ts).or_default().add(value);
            }
        }
    }

    if matches!(reducer, BucketReducer::Average) {
        for (bucket_ts, average) in averages {
            buckets.insert(bucket_ts, average.average());
        }
    }

    let timestamps: Vec<i64> = buckets.keys().copied().collect();
    let players_online: Vec<Option<f64>> = buckets.into_values().collect();
    (timestamps, players_online)
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use super::*;
    use crate::query::MetricQueryWindow;

    #[test]
    fn align_samples_fills_window_grid_with_nulls() {
        let to = UNIX_EPOCH + Duration::from_secs(3_600);
        let from = to - Duration::from_secs(3_600);
        let window = MetricQueryWindow::parse(
            from.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
            to.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
        )
        .unwrap();

        let (timestamps, values) = align_samples_to_window(&window, &[]);
        assert!(!timestamps.is_empty());
        assert_eq!(timestamps.len(), values.len());
        assert!(values.iter().all(|value| value.is_none()));
    }

    #[test]
    fn align_samples_maps_off_grid_points_into_buckets() {
        let to = UNIX_EPOCH + Duration::from_secs(3_600);
        let from = to - Duration::from_secs(3_600);
        let window = MetricQueryWindow::parse(
            from.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
            to.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
        )
        .unwrap();
        let step = window.step_seconds();
        let start = (window.from_epoch() / step) * step;

        let (timestamps, values) =
            align_samples_to_window(&window, &[(start + step / 2, Some(42.0))]);

        assert!(timestamps.contains(&start));
        assert_eq!(
            values[timestamps.iter().position(|ts| *ts == start).unwrap()],
            Some(42.0)
        );
    }

    #[test]
    fn align_samples_avg_averages_colliding_buckets() {
        let to = UNIX_EPOCH + Duration::from_secs(3 * 86_400);
        let from = to - Duration::from_secs(3 * 86_400);
        let window = MetricQueryWindow::parse_daily(
            from.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
            to.duration_since(UNIX_EPOCH).unwrap().as_secs() as i64,
        )
        .unwrap();
        let step = window.step_seconds();
        let start = (window.from_epoch() / step) * step;

        let (_, values) = align_samples_to_window_avg(
            &window,
            &[(start + 3_600, Some(10.0)), (start + 7_200, Some(20.0))],
        );

        assert_eq!(values[0], Some(15.0));
    }

    #[test]
    fn align_samples_avg_matches_two_day_integration_window() {
        let window = MetricQueryWindow::parse_daily(1709913600, 1710086399).unwrap();
        let samples = [(1709856000, Some(10.0)), (1709942400, Some(12.0))];
        let (timestamps, values) = align_samples_to_window_avg(&window, &samples);
        assert_eq!(timestamps, vec![1709856000, 1709942400, 1710028800]);
        assert_eq!(values, vec![Some(10.0), Some(12.0), None]);
    }

    #[test]
    fn align_samples_avg_keeps_day_values_when_zoom_starts_mid_day() {
        let step = 86_400;
        let day0 = 1782777600;
        let day1 = day0 + step;
        let window = MetricQueryWindow::parse_daily(day0 + 3_600, day1).unwrap();
        let samples = [(day0, None), (day1, Some(27_388.0))];
        let (timestamps, values) = align_samples_to_window_avg(&window, &samples);
        assert_eq!(timestamps, vec![day0, day1]);
        assert_eq!(values, vec![None, Some(27_388.0)]);
    }
}
