use mc_api_types::TrendDirection;

pub fn classify_trend(change_pct: Option<f64>) -> TrendDirection {
    match change_pct {
        Some(value) if value > 5.0 => TrendDirection::Growing,
        Some(value) if value < -5.0 => TrendDirection::Declining,
        Some(_) => TrendDirection::Stable,
        None => TrendDirection::Unknown,
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
        assert_eq!(classify_trend(Some(10.0)), TrendDirection::Growing);
    }

    #[test]
    fn declining_trend() {
        assert_eq!(classify_trend(Some(-10.0)), TrendDirection::Declining);
    }

    #[test]
    fn change_from_start_to_end() {
        assert_eq!(change_pct_start_to_end(&[10.0, 12.0]), Some(20.0));
    }
}
