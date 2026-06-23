mod shared;
mod timer;
mod windows;

use tauri_specta::{collect_commands, Builder};

#[tauri::command]
#[specta::specta]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// 集中注册所有 IPC 命令到 tauri-specta Builder。
// run()（注册 invoke handler）与 bin/export_bindings.rs（生成 TS 绑定）共用此函数，
// 保证命令清单单一来源，避免两份注册表漂移。
pub fn build_specta_builder() -> Builder<tauri::Wry> {
    use crate::shared::types::ConfigChangedPayload;
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            exit_app,
            windows::settings::show_settings_window,
            windows::panel::fit_panel,
            shared::config::get_config,
            shared::config::set_config,
            timer::get_timer_state,
            timer::start_work,
            timer::confirm_break,
            timer::confirm_return,
            timer::toggle_pause,
            timer::reset,
            timer::manual_break,
            timer::skip_break,
        ])
        // ConfigChangedPayload 不出现在任何 command 签名中（仅 set_config 内部 emit），
        // 用 typ 显式注册，让 specta 把它导出到 bindings.ts 供前端 listen 复用。
        .typ::<ConfigChangedPayload>()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let specta_builder = build_specta_builder();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
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

            windows::panel::setup(app)?;
            shared::config::init(app)?;
            timer::init(app)?;

            specta_builder.mount_events(app);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
