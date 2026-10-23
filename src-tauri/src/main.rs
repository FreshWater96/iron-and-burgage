#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clyde_crown::sim::ecs_world::{RegionalEngine, Save, Scenario, Snapshot};
use std::sync::{Arc, Mutex};
use tauri::Manager;
type Game = Arc<Mutex<Option<RegionalEngine>>>;
#[tauri::command]
fn region_init(scenario: Scenario, state: tauri::State<Game>) -> Result<(), String> {
    *state.lock().map_err(|e| e.to_string())? = Some(RegionalEngine::new(scenario)?);
    Ok(())
}
#[tauri::command]
fn region_snapshot(state: tauri::State<Game>) -> Result<Snapshot, String> {
    state
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .map(|g| g.snapshot())
        .ok_or("World not initialized".into())
}
#[tauri::command]
fn region_command(
    app: tauri::AppHandle,
    command: serde_json::Value,
    state: tauri::State<Game>,
) -> Result<serde_json::Value, String> {
    let mut lock = state.lock().map_err(|e| e.to_string())?;
    let game = lock.as_mut().ok_or("World not initialized")?;
    match command["type"].as_str().unwrap_or("") {
        "speed" => {
            let n = command["value"].as_u64().ok_or("Invalid speed")?;
            if ![0, 1, 2, 4].contains(&n) {
                return Err("Invalid speed".into());
            }
            game.speed = n as u8;
        }
        "focus" => {
            let a = command["point"].as_array().ok_or("Invalid focus")?;
            if a.len() != 2 {
                return Err("Invalid focus".into());
            }
            game.focus = [
                a[0].as_f64().ok_or("Invalid x")?,
                a[1].as_f64().ok_or("Invalid z")?,
            ];
        }
        "dredge" => game.dredge(command["id"].as_u64().ok_or("Invalid route")? as usize)?,
        "hydro" => game.build_hydro(
            command["flow"].as_f64().ok_or("Invalid flow")?,
            command["head"].as_f64().ok_or("Invalid head")?,
        )?,
        "save" => {
            let save = game.save();
            let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let path = dir.join("region-v1.json");
            let temporary = dir.join("region-v1.tmp");
            std::fs::write(
                &temporary,
                serde_json::to_vec(&save).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            std::fs::rename(&temporary, path).map_err(|e| e.to_string())?;
            return serde_json::to_value(save).map_err(|e| e.to_string());
        }
        "load_disk" => {
            let path = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .join("region-v1.json");
            let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
            let save: Save = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            game.restore(save)?;
        }
        "load" => {
            let save: Save =
                serde_json::from_value(command["save"].clone()).map_err(|e| e.to_string())?;
            game.restore(save)?;
        }
        "depth" => {
            for p in command["depths"]
                .as_array()
                .ok_or("Invalid depth profiles")?
            {
                let id = p["id"].as_u64().ok_or("Invalid route")? as usize;
                let depth = p["depth"].as_f64().ok_or("Invalid depth")?;
                if let Some(r) = game.scenario.routes.get_mut(id) {
                    r.min_depth = depth.max(0.);
                }
            }
        }
        _ => return Err("Unknown regional command".into()),
    }
    Ok(serde_json::Value::Null)
}
fn main() {
    let state: Game = Arc::new(Mutex::new(None));
    let simulation = state.clone();
    std::thread::spawn(move || {
        let step = std::time::Duration::from_millis(50);
        loop {
            let start = std::time::Instant::now();
            if let Ok(mut lock) = simulation.lock() {
                if let Some(game) = lock.as_mut() {
                    for _ in 0..game.speed {
                        game.step(6.);
                    }
                }
            }
            if let Some(remaining) = step.checked_sub(start.elapsed()) {
                std::thread::sleep(remaining);
            }
        }
    });
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            region_init,
            region_snapshot,
            region_command
        ])
        .run(tauri::generate_context!())
        .expect("Could not start Clyde & Crown");
}
