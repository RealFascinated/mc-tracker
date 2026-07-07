#[derive(Debug, Clone, PartialEq)]
pub struct AlignedLane {
    pub step_secs: i64,
    pub timestamps: Vec<i64>,
    pub values: Vec<Option<f64>>,
}
