use mc_chat_types::ChatTrend;

pub fn classify_trend(change_pct: Option<f64>) -> ChatTrend {
    match change_pct {
        Some(value) if value > 5.0 => ChatTrend::Growing,
        Some(value) if value < -5.0 => ChatTrend::Declining,
        Some(_) => ChatTrend::Stable,
        None => ChatTrend::Unknown,
    }
}

pub fn change_pct_start_to_end(values: &[f64]) -> Option<f64> {
    let start = *values.first()?;
    let end = *values.last()?;
    if values.len() < 2 {
        return None;
    }
    if start.abs() < f64::EPSILON {
        return None;
    }
    Some(((end - start) / start) * 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn growing_trend() {
        assert_eq!(classify_trend(Some(10.0)), ChatTrend::Growing);
    }

    #[test]
    fn change_from_start_to_end() {
        assert_eq!(change_pct_start_to_end(&[10.0, 12.0]), Some(20.0));
    }
}
