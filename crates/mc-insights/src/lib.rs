mod analyze;
pub mod constants;
mod error;
mod range;
mod traits;
mod trend;

pub use analyze::DefaultTimeseriesAnalyzer;
pub use constants::DEFAULT_MAX_SUMMARY_POINTS;
pub use error::InsightsError;
pub use range::DefaultTimeRangeParser;
pub use traits::{AnalyzeOptions, ResolvedTimeRange, TimeRangeParser, TimeseriesAnalyzer};
