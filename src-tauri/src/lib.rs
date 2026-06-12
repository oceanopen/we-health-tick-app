mod panel;
mod settings;

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            panel::setup(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            exit_app,
            settings::show_settings_window,
            panel::fit_panel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
