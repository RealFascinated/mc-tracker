//! Loose text search: case-, space-, and punctuation-insensitive matching across fields.

/// One searchable value on a record (e.g. server name, host, asnOrg, id).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SearchField<'a> {
    pub value: &'a str,
}

impl<'a> SearchField<'a> {
    pub const fn new(value: &'a str) -> Self {
        Self { value }
    }
}

/// Lowercase and strip non-alphanumeric characters so `wild network` matches `WildNetwork`.
pub fn normalize(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

fn query_tokens(query: &str) -> Vec<String> {
    query
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(normalize)
        .filter(|part| !part.is_empty())
        .collect()
}

fn value_tokens(value: &str) -> Vec<String> {
    query_tokens(value)
}

fn token_matches(query_token: &str, value_token: &str) -> bool {
    if query_token.is_empty() {
        return true;
    }
    if query_token == value_token {
        return true;
    }
    if query_token.len() >= 4 && value_token.starts_with(query_token) {
        return true;
    }
    if query_token.len() >= 3 && value_token.ends_with(query_token) {
        return true;
    }
    query_token.len() >= 4 && value_token.contains(query_token)
}

/// Loose match of `query` against a single field value (no cross-field combining).
pub fn matches_field(query: &str, value: &str) -> bool {
    let query = query.trim();
    if query.is_empty() {
        return true;
    }

    let q_tokens = query_tokens(query);
    if q_tokens.is_empty() {
        return false;
    }

    let v_tokens = value_tokens(value);
    let norm_value = normalize(value);
    let norm_query = normalize(query);

    if q_tokens.len() == 1 {
        let token = &q_tokens[0];
        if v_tokens.iter().any(|v| token_matches(token, v)) {
            return true;
        }
        if norm_value == norm_query {
            return true;
        }
        return norm_query.len() >= 4 && norm_value.contains(&norm_query);
    }

    q_tokens
        .iter()
        .all(|q| v_tokens.iter().any(|v| token_matches(q, v)))
}

/// `None` or blank query matches everything.
pub fn matches(query: Option<&str>, fields: &[SearchField<'_>]) -> bool {
    let Some(query) = query.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };

    let values: Vec<&str> = fields.iter().map(|field| field.value).collect();
    matches_str(query, &values)
}

pub fn matches_str(query: &str, values: &[&str]) -> bool {
    let query = query.trim();
    if query.is_empty() {
        return true;
    }

    let norm_query = normalize(query);
    if norm_query.is_empty() {
        return false;
    }

    let normalized: Vec<String> = values.iter().map(|value| normalize(value)).collect();
    let combined: String = normalized.iter().map(String::as_str).collect();

    if normalized.iter().any(|value| value.contains(&norm_query)) {
        return true;
    }

    if combined.contains(&norm_query) {
        return true;
    }

    let tokens = query_tokens(query);
    if tokens.len() > 1 {
        return tokens.iter().all(|token| combined.contains(token.as_str()));
    }

    false
}

/// Higher = better match. Returns 0 when there is no match.
pub fn score(query: &str, fields: &[SearchField<'_>]) -> u8 {
    let values: Vec<&str> = fields.iter().map(|field| field.value).collect();
    score_str(query, &values)
}

pub fn score_str(query: &str, values: &[&str]) -> u8 {
    if !matches_str(query, values) {
        return 0;
    }

    let norm_query = normalize(query);
    if norm_query.is_empty() {
        return 0;
    }

    let mut best = 1u8;
    for value in values {
        let norm_value = normalize(value);
        if norm_value == norm_query {
            return 5;
        }
        if norm_value.starts_with(&norm_query) {
            best = best.max(4);
        } else if norm_query.len() >= 3 && norm_value.contains(&norm_query) {
            best = best.max(3);
        }
    }

    let combined: String = values.iter().map(|value| normalize(value)).collect();
    if combined.starts_with(&norm_query) {
        best = best.max(4);
    } else if norm_query.len() >= 3 && combined.contains(&norm_query) {
        best = best.max(2);
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_spacing_and_case() {
        assert_eq!(normalize("Wild Network"), "wildnetwork");
        assert_eq!(normalize("wildnetwork"), "wildnetwork");
        assert_eq!(normalize("WildNetwork"), "wildnetwork");
    }

    #[test]
    fn matches_across_spacing_variants() {
        let fields = [SearchField::new("WildNetwork")];
        assert!(matches(Some("wild network"), &fields));
        assert!(matches(Some("wildnetwork"), &fields));
        assert!(matches(Some("WILD NETWORK"), &fields));
    }

    #[test]
    fn matches_any_field() {
        let fields = [
            SearchField::new("Hypixel"),
            SearchField::new("mc.hypixel.net"),
            SearchField::new("afde2746-edd3-45f5-bd41-676bd39f3c88"),
        ];
        assert!(matches(Some("hypixel"), &fields));
        assert!(matches(Some("afde2746"), &fields));
        assert!(matches(Some("mc.hypixel"), &fields));
        assert!(!matches(Some("mineplex"), &fields));
    }

    #[test]
    fn token_match_on_combined_fields() {
        let fields = [
            SearchField::new("AS13335"),
            SearchField::new("Cloudflare, Inc."),
        ];
        assert!(matches(Some("cloudflare"), &fields));
        assert!(matches(Some("13335"), &fields));
    }

    #[test]
    fn matches_field_is_single_value_only() {
        assert!(matches_field("donut smp", "DonutSMP Network"));
        assert!(!matches_field("donutsmp.net", "DonutSMP Network"));
    }

    #[test]
    fn empty_query_matches_all() {
        let fields = [SearchField::new("Hypixel")];
        assert!(matches(None, &fields));
        assert!(matches(Some(""), &fields));
        assert!(matches(Some("   "), &fields));
    }

    #[test]
    fn score_prefers_exact_and_prefix() {
        let fields = [
            SearchField::new("Hypixel"),
            SearchField::new("mc.hypixel.net"),
        ];
        assert_eq!(score("hypixel", &fields), 5);
        assert!(score("hyp", &fields) >= 4);
    }
}
