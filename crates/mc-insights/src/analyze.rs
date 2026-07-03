use mc_api_types::{timeseries_keys, SummaryPoint, TimeseriesLane, TimeseriesSummaryResponse};
use mc_common::constants::time::SECONDS_PER_DAY;

use crate::error::InsightsError;
use crate::traits::{AnalyzeOptions, TimeseriesAnalyzer};
use crate::trend::{change_pct_start_to_end, classify_trend};

const THREE_DAYS_SECONDS: i64 = 3 * SECONDS_PER_DAY;

pub struct DefaultTimeseriesAnalyzer;

impl TimeseriesAnalyzer for DefaultTimeseriesAnalyzer {
    fn summarize(
        &self,
        lanes: &mc_api_types::TimeseriesLanes,
        options: AnalyzeOptions,
    ) -> Result<TimeseriesSummaryResponse, InsightsError> {
        let series_key = if options.span_seconds >= THREE_DAYS_SECONDS {
            timeseries_keys::PLAYERS_DAILY_AVG
        } else {
            timeseries_keys::PLAYERS_ONLINE
        };
        let lane = lanes.series.get(series_key).ok_or(InsightsError::NoData)?;
        summarize_lane(lanes.from, lanes.to, series_key, lane, options.max_points)
    }
}

fn summarize_lane(
    from: i64,
    to: i64,
    series_key: &str,
    lane: &TimeseriesLane,
    max_points: usize,
) -> Result<TimeseriesSummaryResponse, InsightsError> {
    let values: Vec<(i64, f64)> = lane
        .timestamps
        .iter()
        .zip(lane.values.iter())
        .filter_map(|(ts, value)| value.map(|v| (*ts, v)))
        .collect();
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
    Ok(TimeseriesSummaryResponse {
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

fn downsample_points(values: &[(i64, f64)], max_points: usize) -> Vec<SummaryPoint> {
    if values.len() <= max_points {
        return values
            .iter()
            .map(|(timestamp, value)| SummaryPoint {
                timestamp: *timestamp,
                value: *value,
            })
            .collect();
    }
    let step = values.len().div_ceil(max_points).max(1);
    values
        .iter()
        .step_by(step)
        .map(|(timestamp, value)| SummaryPoint {
            timestamp: *timestamp,
            value: *value,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use mc_api_types::{timeseries_keys, TimeseriesLanes, TrendDirection};

    use super::*;
    use crate::traits::AnalyzeOptions;

    #[test]
    fn summarize_from_fixture_shape() {
        let mut lanes = TimeseriesLanes::new(1_709_913_600, 1_710_086_399);
        lanes.insert_lane(
            timeseries_keys::PLAYERS_ONLINE,
            300,
            vec![1_709_913_600, 1_709_913_900],
            vec![Some(10.0), Some(12.0)],
        );
        let analyzer = DefaultTimeseriesAnalyzer;
        let summary = analyzer
            .summarize(
                &lanes,
                AnalyzeOptions {
                    span_seconds: 3600,
                    max_points: crate::constants::DEFAULT_MAX_SUMMARY_POINTS,
                },
            )
            .unwrap();
        assert_eq!(summary.series_key, timeseries_keys::PLAYERS_ONLINE);
        assert_eq!(summary.end, Some(12.0));
        assert_eq!(summary.start, Some(10.0));
        assert_eq!(summary.change_pct, Some(20.0));
        assert_eq!(summary.trend, TrendDirection::Growing);
    }
}
