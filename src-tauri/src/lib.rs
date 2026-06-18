mod config;
mod panel;
mod settings;
mod timer;

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // macOS 隐藏 Dock 图标：将应用激活策略设为 Accessory（代理应用），
            // 应用不再出现在程序坞和应用菜单栏，只保留顶部状态栏托盘图标。
            // 该 API 仅 macOS 生效；Windows/Linux 任务栏隐藏由各窗口的 skip_taskbar(true) 负责。
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            panel::setup(app)?;
            config::init(app)?;
            timer::init(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            exit_app,
            settings::show_settings_window,
            panel::fit_panel,
            config::get_config,
            config::set_config,
            timer::get_timer_state,
            timer::start_work,
            timer::confirm_break,
            timer::confirm_return,
            timer::toggle_pause,
            timer::reset,
            timer::manual_break,
            timer::skip_break
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
