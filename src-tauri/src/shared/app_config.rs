use rusqlite::{Connection, OptionalExtension, params};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::shared::types::AppConfigChangedPayload;

/// 语言偏好 key（前端镜像 src/shared/appConfig.ts 的 LANGUAGE_KEY，修改任一处需同步）。
/// 后端仅托盘菜单消费（current_language 读取），其余业务不读。
pub const LANGUAGE_KEY: &str = "language";

/// 长休息窗口形态 key（前端镜像 src/shared/appConfig.ts 的 LONG_BREAK_WINDOW_KEY，修改任一处需同步）。
/// 取值同前端 RestWindow（"tray" | "topRight" | "fullscreen"），后端 panel.rs 在长休息
/// 唤起窗口时读取分派。topRight/fullscreen 形态尚未实现，读取侧回退 tray 行为。
pub const LONG_BREAK_WINDOW_KEY: &str = "long_break_window";
pub const LONG_BREAK_WINDOW_TRAY: &str = "tray";

pub struct AppConfigState(pub Mutex<Connection>);

pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    // dev/release 通过不同 identifier（com.we.health.tick.dev / com.we.health.tick）自动隔离
    // app_data_dir，无需手动拼接子目录。
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("app.db");
    let conn = Connection::open(db_path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )?;
    app.manage(AppConfigState(Mutex::new(conn)));
    Ok(())
}

pub fn read_app_config_conn(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM app_config WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row(params![key], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())
}

pub fn read_app_config_raw(state: &AppConfigState, key: &str) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    read_app_config_conn(&conn, key)
}

pub fn write_app_config_conn(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn write_app_config_raw(state: &AppConfigState, key: &str, value: &str) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    write_app_config_conn(&conn, key, value)
}

#[tauri::command]
#[specta::specta]
pub fn get_app_config(
    state: State<'_, AppConfigState>,
    key: String,
) -> Result<Option<String>, String> {
    read_app_config_raw(&state, &key)
}

#[tauri::command]
#[specta::specta]
pub fn set_app_config(
    app: AppHandle,
    state: State<'_, AppConfigState>,
    key: String,
    value: String,
) -> Result<(), String> {
    write_app_config_raw(&state, &key, &value)?;
    app.emit(
        crate::shared::events::EVENT_APP_CONFIG_CHANGED,
        AppConfigChangedPayload { key, value },
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
