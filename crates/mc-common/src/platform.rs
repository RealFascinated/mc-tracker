/// User-facing platform label for a DB/API platform code (`PC` / `PE`).
pub fn platform_display_label(platform: &str) -> &str {
    match platform {
        "PC" => "Java",
        "PE" => "Bedrock",
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::platform_display_label;

    #[test]
    fn platform_display_label_maps_db_codes() {
        assert_eq!(platform_display_label("PC"), "Java");
        assert_eq!(platform_display_label("PE"), "Bedrock");
    }

    #[test]
    fn platform_display_label_passes_through_unknown() {
        assert_eq!(platform_display_label("unknown"), "unknown");
    }
}
