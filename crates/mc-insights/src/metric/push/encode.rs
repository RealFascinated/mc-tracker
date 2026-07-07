use std::collections::BTreeMap;

use crate::metric::push::PlayerCountEntry;
use crate::metric::schema::{labels, HELP_PLAYER_COUNT, METRIC_PLAYER_COUNT};

pub fn encode_player_count(environment: &str, entries: &[PlayerCountEntry]) -> String {
    let mut out = String::new();
    out.push_str("# HELP ");
    out.push_str(METRIC_PLAYER_COUNT);
    out.push(' ');
    out.push_str(HELP_PLAYER_COUNT);
    out.push('\n');
    out.push_str("# TYPE ");
    out.push_str(METRIC_PLAYER_COUNT);
    out.push_str(" gauge\n");

    for entry in entries {
        let labels = BTreeMap::from([
            (labels::ASN, entry.asn.as_str()),
            (labels::ASN_ORG, entry.asn_org.as_str()),
            (labels::ENVIRONMENT, environment),
            (labels::ID, entry.id.as_str()),
            (labels::NAME, entry.name.as_str()),
            (labels::TYPE, entry.server_type.as_str()),
        ]);

        out.push_str(METRIC_PLAYER_COUNT);
        out.push('{');
        for (index, (key, value)) in labels.iter().enumerate() {
            if index > 0 {
                out.push(',');
            }
            out.push_str(key);
            out.push_str("=\"");
            append_escaped_label_value(&mut out, value);
            out.push('"');
        }
        out.push('}');
        out.push(' ');
        out.push_str(&format_sample_value(entry.value));
        out.push('\n');
    }

    out
}

fn append_escaped_label_value(out: &mut String, value: &str) {
    for ch in value.chars() {
        if ch == '\\' || ch == '"' {
            out.push('\\');
        }
        out.push(ch);
    }
}

fn format_sample_value(value: f64) -> String {
    if value.fract() == 0.0 && value.is_finite() {
        format!("{}", value as i64)
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metric::push::PlayerCountEntry;

    #[test]
    fn encodes_fixture_shape() {
        let body = encode_player_count(
            "development",
            &[PlayerCountEntry {
                id: "550e8400-e29b-41d4-a716-446655440000".into(),
                name: "Hypixel".into(),
                server_type: "PC".into(),
                asn: "AS13335".into(),
                asn_org: "Cloudflare".into(),
                value: 42.0,
            }],
        );

        let expected = include_str!("../../../tests/fixtures/push/player-count.txt");
        assert_eq!(body, expected);
    }

    #[test]
    fn escapes_quotes_in_labels() {
        let body = encode_player_count(
            "development",
            &[PlayerCountEntry {
                id: "id".into(),
                name: "Test \"Server\"".into(),
                server_type: "PC".into(),
                asn: String::new(),
                asn_org: String::new(),
                value: 1.0,
            }],
        );
        assert!(body.contains(r#"name="Test \"Server\"""#));
    }
}
