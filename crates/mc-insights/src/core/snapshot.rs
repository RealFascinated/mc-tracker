use std::collections::BTreeMap;

use mc_chat_types::{ChatPoint, ChatTimeseriesSnapshot};
use mc_common::constants::time::SECONDS_PER_DAY;

use crate::core::trend::{change_pct_start_to_end, classify_trend};
use crate::error::InsightsError;
use crate::metric::AlignedLane;

pub const DEFAULT_MAX_SNAPSHOT_POINTS: usize = 90;

pub fn lane_to_snapshot(
    from: i64,
    to: i64,
    series_key: &str,
    lane: &AlignedLane,
    max_points: usize,
) -> Result<ChatTimeseriesSnapshot, InsightsError> {
    let raw: Vec<(i64, f64)> = lane
        .timestamps
        .iter()
        .zip(lane.values.iter())
        .filter_map(|(ts, value)| value.map(|v| (*ts, v)))
        .collect();
    if raw.is_empty() {
        return Err(InsightsError::NoData);
    }

    let values = collapse_daily_averages(&raw);
    if values.is_empty() {
        return Err(InsightsError::NoData);
    }

    let nums: Vec<f64> = values.iter().map(|(_, v)| *v).collect();
    let start = nums.first().copied();
    let end = nums.last().copied();
    let min = nums.iter().copied().fold(f64::INFINITY, f64::min);
    let max = nums.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let avg = nums.iter().sum::<f64>() / nums.len() as f64;
    let change_pct = change_pct_start_to_end(&nums);
    let trend = classify_trend(change_pct);
    let points = downsample_points(&values, max_points);

    Ok(ChatTimeseriesSnapshot {
        from,
        to,
        series_key: series_key.to_string(),
        start,
        end,
        avg: Some(avg),
        min: Some(min),
        max: Some(max),
        change_pct,
        trend,
        points,
    })
}

fn collapse_daily_averages(values: &[(i64, f64)]) -> Vec<(i64, f64)> {
    let mut buckets: BTreeMap<i64, Vec<f64>> = BTreeMap::new();
    for (timestamp, value) in values {
        let day = timestamp.div_euclid(SECONDS_PER_DAY);
        buckets.entry(day).or_default().push(*value);
    }

    buckets
        .into_iter()
        .map(|(day, samples)| {
            let avg = samples.iter().sum::<f64>() / samples.len() as f64;
            (day * SECONDS_PER_DAY, avg)
        })
        .collect()
}

fn downsample_points(values: &[(i64, f64)], max_points: usize) -> Vec<ChatPoint> {
    if values.len() <= max_points {
        return values
            .iter()
            .map(|(timestamp, value)| ChatPoint {
                timestamp: *timestamp,
                value: *value,
            })
            .collect();
    }
    let step = values.len().div_ceil(max_points).max(1);
    values
        .iter()
        .step_by(step)
        .map(|(timestamp, value)| ChatPoint {
            timestamp: *timestamp,
            value: *value,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use mc_chat_types::ChatTrend;

    use crate::metric::AlignedLane;

    use super::*;

    #[test]
    fn snapshot_from_daily_lane() {
        let lane = AlignedLane {
            step_secs: 86_400,
            timestamps: vec![1_700_000_000, 1_700_086_400, 1_700_172_800],
            values: vec![Some(10.0), Some(12.0), Some(14.0)],
        };
        let snapshot =
            lane_to_snapshot(1_700_000_000, 1_700_172_800, "playersOnline", &lane, 90).unwrap();
        assert_eq!(snapshot.start, Some(10.0));
        assert_eq!(snapshot.end, Some(14.0));
        assert_eq!(snapshot.change_pct, Some(40.0));
        assert_eq!(snapshot.trend, ChatTrend::Growing);
    }
}
