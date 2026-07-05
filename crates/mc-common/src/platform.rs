pub const DEFAULT_JAVA_PORT: u16 = 25565;
pub const DEFAULT_BEDROCK_PORT: u16 = 19132;

/// User-facing platform label for a DB/API platform code (`PC` / `PE`).
pub fn platform_display_label(platform: &str) -> &str {
    match platform {
        "PC" => "Java",
        "PE" => "Bedrock",
        other => other,
    }
}

pub fn default_port_for_platform(platform: &str) -> u16 {
    match platform {
        "PE" => DEFAULT_BEDROCK_PORT,
        _ => DEFAULT_JAVA_PORT,
    }
}

pub fn effective_server_port(port: Option<i32>, platform: &str) -> u16 {
    port.map(|value| value as u16)
        .unwrap_or_else(|| default_port_for_platform(platform))
}

#[cfg(test)]
mod tests {
    use super::{
        effective_server_port, platform_display_label, DEFAULT_BEDROCK_PORT, DEFAULT_JAVA_PORT,
    };

    #[test]
    fn platform_display_label_maps_db_codes() {
        assert_eq!(platform_display_label("PC"), "Java");
        assert_eq!(platform_display_label("PE"), "Bedrock");
    }

    #[test]
    fn platform_display_label_passes_through_unknown() {
        assert_eq!(platform_display_label("unknown"), "unknown");
    }

    #[test]
    fn effective_server_port_uses_platform_default() {
        assert_eq!(effective_server_port(None, "PC"), DEFAULT_JAVA_PORT);
        assert_eq!(effective_server_port(None, "PE"), DEFAULT_BEDROCK_PORT);
        assert_eq!(effective_server_port(Some(25566), "PC"), 25566);
    }
}
