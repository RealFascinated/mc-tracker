use std::collections::BTreeMap;

pub fn escape_label_value(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        if ch == '\\' || ch == '"' {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}

pub fn vector_selector(metric_name: &str, labels: &BTreeMap<&str, &str>) -> String {
    if labels.is_empty() {
        return metric_name.to_string();
    }

    let mut out = String::from(metric_name);
    out.push('{');
    for (index, (key, value)) in labels.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(key);
        out.push_str("=\"");
        out.push_str(&escape_label_value(value));
        out.push('"');
    }
    out.push('}');
    out
}

pub fn avg_over_time(expr: &str, subrange: &str) -> String {
    format!("avg_over_time({expr}[{subrange}])")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_backslash_and_quote() {
        assert_eq!(escape_label_value(r#"a"b\c"#), r#"a\"b\\c"#);
    }

    #[test]
    fn vector_selector_renders_sorted_labels() {
        let labels = BTreeMap::from([("environment", "production"), ("id", "server-1")]);
        assert_eq!(
            vector_selector("minecraft_server_player_count", &labels),
            r#"minecraft_server_player_count{environment="production",id="server-1"}"#
        );
    }

    #[test]
    fn avg_over_time_wraps_expression() {
        assert_eq!(avg_over_time("up", "1d:1h"), "avg_over_time(up[1d:1h])");
    }
}
