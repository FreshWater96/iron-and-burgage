pub fn tide_level(seconds: f64) -> f64 {
    0.9 * (seconds / (12.42 * 3600.0) * std::f64::consts::TAU).sin()
        + 0.35 * (seconds / (24.0 * 3600.0) * std::f64::consts::TAU).sin()
}
pub fn clearance(depth: f64, tide: f64, draft: f64) -> f64 {
    depth + tide - draft - 0.3
}
pub fn traction_speed(base: f64, grade: f64, cargo: f64) -> f64 {
    base / (1.0 + grade.max(0.0) * 30.0 * (1.0 + cargo / 40.0))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn draft_is_not_ignored() {
        assert!(clearance(2.4, 0.0, 3.6) < 0.0);
        assert!(clearance(6.0, -1.2, 3.6) > 0.0);
    }
    #[test]
    fn loaded_gradient_slows_train() {
        assert!(traction_speed(16.0, 0.02, 40.0) < traction_speed(16.0, 0.02, 0.0));
    }
}
