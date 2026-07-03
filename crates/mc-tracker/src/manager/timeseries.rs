use mc_api_types::{
    timeseries_keys, AsnTimeseriesResponse, ServerTimeseriesResponse, TimeseriesLane,
    TimeseriesLanes,
};
use mc_metrics::{
    align_samples_to_window, align_samples_to_window_avg, player_count_daily_average_series,
    player_count_series, players_for_asn_series, total_players_series, MetricQueryWindow,
    MetricsError, VmQueryBuilder, VmQueryClient,
};
use uuid::Uuid;

use super::ServerManager;

fn timeseries_lane(
    window: &MetricQueryWindow,
    samples: &[(i64, Option<f64>)],
    average: bool,
) -> TimeseriesLane {
    let (timestamps, values) = if average {
        align_samples_to_window_avg(window, samples)
    } else {
        align_samples_to_window(window, samples)
    };

    TimeseriesLane {
        step: window.step_seconds(),
        timestamps,
        values,
    }
}

impl ServerManager {
    pub async fn asn_timeseries(
        &self,
        asn: &str,
        asn_org: &str,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<AsnTimeseriesResponse, MetricsError> {
        if !self.asn_is_tracked(asn, asn_org).await {
            return Err(MetricsError::InvalidWindow("asn not found".into()));
        }

        let window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let promql = players_for_asn_series(self.environment(), asn, asn_org);
        let samples = self.query_player_count_series(&window, &promql).await?;
        let lane = timeseries_lane(&window, &samples, false);

        let mut timeseries = TimeseriesLanes::new(window.from_epoch(), window.to_epoch());
        timeseries.insert_lane(
            timeseries_keys::PLAYERS_ONLINE,
            lane.step,
            lane.timestamps,
            lane.values,
        );

        Ok(AsnTimeseriesResponse {
            asn: asn.to_string(),
            asn_org: asn_org.to_string(),
            timeseries,
        })
    }

    pub async fn server_timeseries(
        &self,
        id: Uuid,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<ServerTimeseriesResponse, MetricsError> {
        if self
            .get_tracked(id)
            .await
            .is_none_or(|server| !server.is_tracking())
        {
            return Err(MetricsError::InvalidWindow("server not found".into()));
        }

        let fine_window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let daily_window = MetricQueryWindow::parse_daily(from_epoch, to_epoch)?;
        let server_id = id.to_string();
        let fine_promql = player_count_series(self.environment(), &server_id);
        let daily_promql = player_count_daily_average_series(self.environment(), &server_id);

        let (fine_samples, daily_samples) = tokio::try_join!(
            self.query_player_count_series(&fine_window, &fine_promql),
            self.query_player_count_series(&daily_window, &daily_promql),
        )?;

        let fine_lane = timeseries_lane(&fine_window, &fine_samples, false);
        let daily_lane = timeseries_lane(&daily_window, &daily_samples, true);

        let mut timeseries = TimeseriesLanes::new(fine_window.from_epoch(), fine_window.to_epoch());
        timeseries.insert_lane(
            timeseries_keys::PLAYERS_ONLINE,
            fine_lane.step,
            fine_lane.timestamps,
            fine_lane.values,
        );
        timeseries.insert_lane(
            timeseries_keys::PLAYERS_DAILY_AVG,
            daily_lane.step,
            daily_lane.timestamps,
            daily_lane.values,
        );

        Ok(ServerTimeseriesResponse {
            id: server_id,
            timeseries,
        })
    }

    pub async fn total_timeseries(
        &self,
        from_epoch: i64,
        to_epoch: i64,
    ) -> Result<ServerTimeseriesResponse, MetricsError> {
        let window = MetricQueryWindow::parse(from_epoch, to_epoch)?;
        let promql = total_players_series(self.environment());
        let samples = self.query_player_count_series(&window, &promql).await?;
        let lane = timeseries_lane(&window, &samples, false);

        let mut timeseries = TimeseriesLanes::new(window.from_epoch(), window.to_epoch());
        timeseries.insert_lane(
            timeseries_keys::PLAYERS_ONLINE,
            lane.step,
            lane.timestamps,
            lane.values,
        );

        Ok(ServerTimeseriesResponse {
            id: "total".to_string(),
            timeseries,
        })
    }

    async fn query_player_count_series(
        &self,
        window: &MetricQueryWindow,
        promql: &str,
    ) -> Result<Vec<(i64, Option<f64>)>, MetricsError> {
        let query = VmQueryBuilder::default()
            .query(promql)
            .from(window.vm_query_from())
            .to(window.vm_query_to())
            .step(window.step())
            .build()?;

        let client = self.query_client.read().await;
        let response = client.execute(&query).await?;
        drop(client);

        Ok(VmQueryClient::matrix_samples(&response))
    }
}
