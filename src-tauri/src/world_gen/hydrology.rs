pub fn hydro_power_mw(flow: f64, head: f64, efficiency: f64) -> Result<f64, String> {
    if !flow.is_finite()
        || !head.is_finite()
        || !efficiency.is_finite()
        || flow < 0.0
        || head < 0.0
        || !(0.0..=1.0).contains(&efficiency)
    {
        return Err("Invalid hydro parameters".into());
    }
    Ok(1000.0 * 9.80665 * flow * head * efficiency / 1_000_000.0)
}
pub fn flood_reservoir(
    elevations: &[f32],
    width: usize,
    height: usize,
    seed: usize,
    level: f32,
) -> Vec<u8> {
    let mut wet = vec![0; elevations.len()];
    if width.checked_mul(height) != Some(elevations.len())
        || seed >= elevations.len()
        || elevations[seed] >= level
    {
        return wet;
    }
    let mut queue = vec![0usize; elevations.len()];
    let (mut read, mut write) = (0, 1);
    queue[0] = seed;
    wet[seed] = 1;
    while read < write {
        let i = queue[read];
        read += 1;
        let (x, y) = (i % width, i / width);
        for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
            let (nx, ny) = (x as isize + dx, y as isize + dy);
            if nx < 0 || ny < 0 || nx >= width as isize || ny >= height as isize {
                continue;
            }
            let j = ny as usize * width + nx as usize;
            if wet[j] == 0 && elevations[j].is_finite() && elevations[j] < level {
                wet[j] = 1;
                queue[write] = j;
                write += 1;
            }
        }
    }
    wet
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn power_has_physical_units() {
        assert!((hydro_power_mw(20.0, 100.0, 0.9).unwrap() - 17.65197).abs() < 0.0001);
    }
    #[test]
    fn disconnected_valley_is_dry() {
        let h = [0., 9., 0., 0., 9., 0.];
        let w = flood_reservoir(&h, 3, 2, 0, 2.);
        assert_eq!(w, vec![1, 0, 0, 1, 0, 0]);
    }
}
