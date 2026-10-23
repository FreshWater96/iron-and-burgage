pub const ACTIVE_RADIUS: f64 = 3_000.0;
pub fn is_micro(x: f64, z: f64, camera: [f64; 2]) -> bool {
    (x - camera[0]).hypot(z - camera[1]) < ACTIVE_RADIUS
}
