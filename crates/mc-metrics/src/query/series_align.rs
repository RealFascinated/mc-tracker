use std::collections::BTreeMap;

use crate::query::MetricQueryWindow;

/// Expand sparse VictoriaMetrics samples onto the query window grid (at most [`max_points`]).
pub fn align_samples_to_window(
    window: &MetricQueryWindow,
    samples: &[(i64, Option<f64>)],
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

    for (sample_ts, value) in samples {
        let Some(value) = *value else {
            continue;
        };
        let index = (*sample_ts - start) / step;
        let bucket_ts = start + index * step;
        if bucket_ts < start || bucket_ts > to {
            continue;
        }

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
}
