mod catalog;
mod chat;
mod core;
mod error;
mod insights;
mod metric;

pub use catalog::{AsnPeakKey, ServerCatalog, ServerMeta};
pub use chat::InsightsChat;
pub use error::InsightsError;
pub use insights::Insights;
pub use metric::{
    labels, max_points, max_span, min_span, min_step, peak_players_24h, peak_players_24h_by_asn,
    peak_players_24h_by_server, peak_players_7d, player_count_series, PlayerCountEntry,
};
