mod analyze;
mod error;
mod range;
mod traits;
mod trend;

pub use analyze::DefaultTimeseriesAnalyzer;
pub use error::InsightsError;
pub use range::DefaultTimeRangeParser;
pub use traits::{AnalyzeOptions, ResolvedTimeRange, TimeRangeParser, TimeseriesAnalyzer};
