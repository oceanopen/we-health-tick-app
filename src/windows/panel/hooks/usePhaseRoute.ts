import type { Phase } from '@src/shared/bindings';
import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { matchPhasePath, phaseToPath } from '../routes';

// panel 窗口「phase 驱动导航」镜像层：后端 phase → URL 单向同步。
// 职责边界：useTimerState 是数据层（后端事件 → React state），本 hook 只做 phase → URL 镜像，
// <Routes> 是分发层（URL → 视图）。URL 是后端状态机的影子，无历史语义。
//
// 不变量：
// - 单实例约束：panel 内只能挂载一次，两个实例会对同一 URL 互相纠偏（与 useTimerState 独占订阅同级）。
// - replace-only：navigate 一律 replace，历史栈恒为深度 1，杜绝「回退」语义（phase 本身不可回退）。
// - 防循环：守卫 matchPhasePath(location.pathname) !== phase，URL 已一致时不 navigate。
//
// useLayoutEffect（而非 useEffect）：navigate（router 内部 setState）在浏览器 paint 前同步 flush，
// phase 切换的那次 render 中旧视图不会上屏——与改造前三元分发的行为严格等价。
export function usePhaseRoute(phase: Phase) {
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (matchPhasePath(location.pathname) !== phase) {
      navigate(phaseToPath(phase), { replace: true });
    }
  }, [phase, location.pathname, navigate]);
}
