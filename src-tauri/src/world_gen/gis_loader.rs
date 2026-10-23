use std::io::Read;
/// Frontend GeoTIFF decoding supplies EPSG:27700 float tiles. Native disk tiles have
/// a 12-byte (width, height, EPSG) little-endian header followed by f32 samples.
pub struct HeightTile {
    pub width: usize,
    pub height: usize,
    pub elevations: Vec<f32>,
}
pub fn read_height_tile(mut reader: impl Read) -> Result<HeightTile, String> {
    let mut header = [0u8; 12];
    reader.read_exact(&mut header).map_err(|e| e.to_string())?;
    let width = u32::from_le_bytes(header[0..4].try_into().unwrap()) as usize;
    let height = u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize;
    let epsg = u32::from_le_bytes(header[8..12].try_into().unwrap());
    if epsg != 27700 || width < 2 || height < 2 || width > 8192 || height > 8192 {
        return Err("Unsupported tile dimensions or projection".into());
    }
    let size = width
        .checked_mul(height)
        .and_then(|v| v.checked_mul(4))
        .ok_or("Tile overflow")?;
    let mut bytes = vec![0u8; size];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    let elevations = bytes
        .chunks_exact(4)
        .map(|v| f32::from_le_bytes(v.try_into().unwrap()))
        .collect();
    Ok(HeightTile {
        width,
        height,
        elevations,
    })
}
