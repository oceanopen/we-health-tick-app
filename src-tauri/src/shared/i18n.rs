use sys_locale::get_locale;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ResolvedLanguage {
    ZhCn,
    En,
}

// 系统语言探测：非 zh locale 默认英文（与前端 i18next fallbackLng='en' 一致）。
fn detect_system_language() -> ResolvedLanguage {
    match get_locale() {
        Some(locale) if locale.to_lowercase().starts_with("zh") => ResolvedLanguage::ZhCn,
        _ => ResolvedLanguage::En,
    }
}

// 三态解析：zh-CN/en 直接映射，None 或 "system" 走系统 locale 探测。
pub fn resolve(raw: Option<&str>) -> ResolvedLanguage {
    match raw {
        Some("zh-CN") => ResolvedLanguage::ZhCn,
        Some("en") => ResolvedLanguage::En,
        _ => detect_system_language(),
    }
}

/// 后端文案仅覆盖托盘菜单（业务文案在前端 react-i18next）。
/// 加 key 时同步 refresh_menu_texts 与 setup 的菜单构建。
pub fn menu_text(lang: ResolvedLanguage, key: &str) -> &'static str {
    match (lang, key) {
        (ResolvedLanguage::ZhCn, "settings") => "系统设置",
        (ResolvedLanguage::ZhCn, "restart") => "重启",
        (ResolvedLanguage::ZhCn, "exit") => "退出",
        (ResolvedLanguage::En, "settings") => "Settings",
        (ResolvedLanguage::En, "restart") => "Restart",
        (ResolvedLanguage::En, "exit") => "Quit",
        _ => "",
    }
}
