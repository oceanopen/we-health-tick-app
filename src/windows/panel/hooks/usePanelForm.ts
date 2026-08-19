import type { PanelForm } from '@src/shared/bindings';
import { commands } from '@src/shared/bindings';
import { EVENT_PANEL_FORM_CHANGED } from '@src/shared/events';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';

// panel 窗口形态订阅（与 useTimerState 同构：mount 拉取 + 事件实时更新）。
// PanelForm 是后端受管状态（panel.rs sync_panel_form 唯一写入口），
// 前端不做任何推导，只镜像：全屏进出副作用完成后 emit_to("panel") 广播，
// mount 拉 getPanelForm 兜底 webview 重载收不到历史事件的场景。
export function usePanelForm(): PanelForm {
  const [form, setForm] = useState<PanelForm>('tray');

  useEffect(() => {
    let cancelled = false;
    // getPanelForm 返回裸 PanelForm（无 Result 包装），错误时 invoke reject → safeAwait 风格捕获。
    void commands
      .getPanelForm()
      .then((form) => {
        if (!cancelled) {
          setForm(form);
        }
      })
      .catch(e => console.warn('[getPanelForm]', e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const promise = listen<PanelForm>(EVENT_PANEL_FORM_CHANGED, e => setForm(e.payload));
    return () => {
      promise
        .then(fn => fn())
        .catch(err => console.warn('[panelForm] unlisten failed:', err));
    };
  }, []);

  return form;
}
