mod client;
mod error;
mod push;
pub(crate) mod query;
mod schema;

pub use client::{LabeledInstantValue, VmQueryClient};
pub use error::MetricsError;
pub use push::{PlayerCountEntry, PlayerCountRegistry, VmPushClient};
pub use query::{
    avg_over_time, avg_trend_by_server, max_points, max_span, min_span, min_step, peak_players_24h,
    peak_players_24h_by_asn, peak_players_24h_by_server, peak_players_7d,
    per_server_players_series, player_count_series, players_for_asn_series,
    total_players_by_type_series, total_players_series, AlignedLane, MetricQueryWindow,
    VmQueryBuilder, VmRangeQuery,
};
pub use schema::labels;
