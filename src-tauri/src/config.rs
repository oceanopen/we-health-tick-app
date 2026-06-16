use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct ConfigState(Mutex<Connection>);

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    let db_path = app_data_dir.join("app.db");
    let conn = Connection::open(db_path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )?;
    app.manage(ConfigState(Mutex::new(conn)));
    Ok(())
}

#[tauri::command]
pub fn get_config(state: State<'_, ConfigState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM config WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let value = stmt
        .query_row(params![&key], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(value)
}

#[tauri::command]
pub fn set_config(
    app: AppHandle,
    state: State<'_, ConfigState>,
    key: String,
    value: String,
) -> Result<(), String> {
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params![&key, &value],
        )
        .map_err(|e| e.to_string())?;
    }
    app.emit(
        "config-changed",
        serde_json::json!({ "key": key, "value": value }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
