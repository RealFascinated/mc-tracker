pub mod constants;
pub mod platform;
pub mod time;

pub use platform::{
    default_port_for_platform, effective_server_port, platform_display_label,
    DEFAULT_BEDROCK_PORT, DEFAULT_JAVA_PORT,
};
pub use time::{now_ms, unix_now_ms};
