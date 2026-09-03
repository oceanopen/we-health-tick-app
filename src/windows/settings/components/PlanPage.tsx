import type { SelectChangeEvent } from '@mui/material/Select';
import type {
  DndHoursEnabled,
  LongBreakEnabled,
  QuietHourPeriod,
  QuietHoursEnabled,
} from '@src/shared/appConfig';
import type { PeriodItem } from './PeriodListEditor';
import AvTimerOutlinedIcon from '@mui/icons-material/AvTimerOutlined';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Switch,
  Typography,
} from '@mui/material';
import {
  BREAK_DURATION_KEY,
  decodeDndHours,
  decodeQuietHours,
  DEFAULT_BREAK_DURATION,
  DEFAULT_DND_HOURS,
  DEFAULT_DND_HOURS_ENABLED,
  DEFAULT_LONG_BREAK_DURATION,
  DEFAULT_LONG_BREAK_ENABLED,
  DEFAULT_LONG_BREAK_INTERVAL,
  DEFAULT_QUIET_HOURS,
  DEFAULT_QUIET_HOURS_ENABLED,
  DEFAULT_WORK_DURATION,
  DND_HOURS_ENABLED_KEY,
  DND_HOURS_KEY,
  encodePeriods,
  getAppConfig,
  LONG_BREAK_DURATION_KEY,
  LONG_BREAK_ENABLED_KEY,
  LONG_BREAK_INTERVAL_KEY,
  parseYesNo,
  QUIET_HOURS_ENABLED_KEY,
  QUIET_HOURS_KEY,
  setAppConfig,
  toYesNo,
  WORK_DURATION_KEY,
  YES_NO,
} from '@src/shared/appConfig';
import { longBreakIntervalOptions } from '@src/shared/settingOption';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PeriodListEditor } from './PeriodListEditor';

interface AppPlanConfig {
  workDuration: number;
  breakDuration: number;
  longBreakEnabled: LongBreakEnabled;
  longBreakInterval: number;
  longBreakDuration: number;
  quietHoursEnabled: QuietHoursEnabled;
  quietHours: PeriodItem[];
  dndHoursEnabled: DndHoursEnabled;
  dndHours: PeriodItem[];
}

const DEFAULT_APP_PLAN_CONFIG: AppPlanConfig = {
  workDuration: DEFAULT_WORK_DURATION,
  breakDuration: DEFAULT_BREAK_DURATION,
  longBreakEnabled: DEFAULT_LONG_BREAK_ENABLED,
  longBreakInterval: DEFAULT_LONG_BREAK_INTERVAL,
  longBreakDuration: DEFAULT_LONG_BREAK_DURATION,
  quietHoursEnabled: DEFAULT_QUIET_HOURS_ENABLED,
  quietHours: DEFAULT_QUIET_HOURS.map((p, i) => ({ ...p, id: i + 1 })),
  dndHoursEnabled: DEFAULT_DND_HOURS_ENABLED,
  // 断言说明：bindings 的 DEFAULT_DND_HOURS 为 `[] as const`（空元组，元素类型 never 不可展开），
  // 断言回通用时段数组以取 SSOT 默认值；默认为空时 map 结果同 `[]`。
  dndHours: (DEFAULT_DND_HOURS as readonly QuietHourPeriod[]).map((p, i) => ({ ...p, id: i + 1 })),
};

function PlanPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<AppPlanConfig>(DEFAULT_APP_PLAN_CONFIG);
  const [draft, setDraft] = useState<AppPlanConfig>(DEFAULT_APP_PLAN_CONFIG);
  // 双列表（quietHours / dndHours）共享的单调 id 计数器：覆盖「DB 加载」与「新增行」
  // 两个分配点。初值 = DEFAULT quietHours 的最大初始 id，此后分配值严格大于默认 id 段；
  // React key 仅要求列表内唯一，reset 回 DEFAULT 列表（id 1..n）不与分配值冲突。
  const periodIdRef = useRef(DEFAULT_APP_PLAN_CONFIG.quietHours.length);

  const allocatePeriodId = () => {
    periodIdRef.current += 1;
    return periodIdRef.current;
  };

  useEffect(() => {
    Promise.all([
      getAppConfig(WORK_DURATION_KEY),
      getAppConfig(BREAK_DURATION_KEY),
      getAppConfig(LONG_BREAK_ENABLED_KEY),
      getAppConfig(LONG_BREAK_INTERVAL_KEY),
      getAppConfig(LONG_BREAK_DURATION_KEY),
      getAppConfig(QUIET_HOURS_ENABLED_KEY),
      getAppConfig(QUIET_HOURS_KEY),
      getAppConfig(DND_HOURS_ENABLED_KEY),
      getAppConfig(DND_HOURS_KEY),
    ]).then(([wd, bd, lbe, lbi, lbdu, qhe, qh, dnde, dnh]) => {
      const next: AppPlanConfig = {
        workDuration: wd ? Number(wd) : DEFAULT_WORK_DURATION,
        breakDuration: bd ? Number(bd) : DEFAULT_BREAK_DURATION,
        longBreakEnabled: parseYesNo(lbe, DEFAULT_LONG_BREAK_ENABLED),
        longBreakInterval: lbi ? Number(lbi) : DEFAULT_LONG_BREAK_INTERVAL,
        longBreakDuration: lbdu ? Number(lbdu) : DEFAULT_LONG_BREAK_DURATION,
        quietHoursEnabled: parseYesNo(qhe, DEFAULT_QUIET_HOURS_ENABLED),
        quietHours: decodeQuietHours(qh).map(p => ({ ...p, id: allocatePeriodId() })),
        dndHoursEnabled: parseYesNo(dnde, DEFAULT_DND_HOURS_ENABLED),
        dndHours: decodeDndHours(dnh).map(p => ({ ...p, id: allocatePeriodId() })),
      };
      setSaved(next);
      setDraft(next);
    });
  }, []);

  const update = <K extends keyof AppPlanConfig>(key: K, value: AppPlanConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const dirty
    = saved.workDuration !== draft.workDuration
      || saved.breakDuration !== draft.breakDuration
      || saved.longBreakEnabled !== draft.longBreakEnabled
      || saved.longBreakInterval !== draft.longBreakInterval
      || saved.longBreakDuration !== draft.longBreakDuration
      || saved.quietHoursEnabled !== draft.quietHoursEnabled
      || JSON.stringify(saved.quietHours) !== JSON.stringify(draft.quietHours)
      || saved.dndHoursEnabled !== draft.dndHoursEnabled
      || JSON.stringify(saved.dndHours) !== JSON.stringify(draft.dndHours);

  const handleReset = () => setDraft(DEFAULT_APP_PLAN_CONFIG);
  const handleCancel = () => setDraft(saved);

  const handleSave = async () => {
    await Promise.all([
      setAppConfig(WORK_DURATION_KEY, String(draft.workDuration)),
      setAppConfig(BREAK_DURATION_KEY, String(draft.breakDuration)),
      setAppConfig(LONG_BREAK_ENABLED_KEY, draft.longBreakEnabled),
      setAppConfig(LONG_BREAK_INTERVAL_KEY, String(draft.longBreakInterval)),
      setAppConfig(LONG_BREAK_DURATION_KEY, String(draft.longBreakDuration)),
      setAppConfig(QUIET_HOURS_ENABLED_KEY, draft.quietHoursEnabled),
      setAppConfig(
        QUIET_HOURS_KEY,
        encodePeriods(draft.quietHours.map(({ id: _id, ...rest }) => rest)),
      ),
      setAppConfig(DND_HOURS_ENABLED_KEY, draft.dndHoursEnabled),
      setAppConfig(
        DND_HOURS_KEY,
        encodePeriods(draft.dndHours.map(({ id: _id, ...rest }) => rest)),
      ),
    ]);
    setSaved(draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography
          variant="body2"
          sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}
        >
          {t('plan:card.timer')}
        </Typography>
        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
            mb: 3,
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AvTimerOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography>{t('plan:row.workDuration')}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {draft.workDuration}
                {' '}
                {t('plan:unit.minutes')}
              </Typography>
            </Box>
            <Slider
              value={draft.workDuration}
              onChange={(_, v) => update('workDuration', v as number)}
              min={1}
              max={120}
              step={1}
              size="small"
            />
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FreeBreakfastOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography>{t('plan:row.breakDuration')}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {draft.breakDuration}
                {' '}
                {t('plan:unit.minutes')}
              </Typography>
            </Box>
            <Slider
              value={draft.breakDuration}
              onChange={(_, v) => update('breakDuration', v as number)}
              min={1}
              max={15}
              step={1}
              size="small"
            />
          </Box>

          <Divider />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SelfImprovementOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('plan:row.longBreakEnabled')}</Typography>
            </Box>
            <Switch
              checked={draft.longBreakEnabled === YES_NO.YES}
              onChange={e => update('longBreakEnabled', toYesNo(e.target.checked))}
            />
          </Box>

          <Divider />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.5,
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <RepeatOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('plan:row.longBreakInterval')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={draft.longBreakInterval}
                onChange={(e: SelectChangeEvent<number>) =>
                  update('longBreakInterval', Number(e.target.value))}
              >
                {longBreakIntervalOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey, { count: opt.value })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HourglassEmptyOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography>{t('plan:row.longBreakDuration')}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {draft.longBreakDuration}
                {' '}
                {t('plan:unit.minutes')}
              </Typography>
            </Box>
            <Slider
              value={draft.longBreakDuration}
              onChange={(_, v) => update('longBreakDuration', v as number)}
              min={1}
              max={30}
              step={1}
              size="small"
            />
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}
        >
          {t('plan:card.schedule')}
        </Typography>
        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <NightsStayOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography>{t('plan:row.quietHours')}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {t('plan:row.quietHoursHint')}
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={draft.quietHoursEnabled === YES_NO.YES}
                onChange={e => update('quietHoursEnabled', toYesNo(e.target.checked))}
              />
            </Box>
            <Box sx={{ pl: 4.25 }}>
              <PeriodListEditor
                periods={draft.quietHours}
                emptyKey="plan:quietHours.empty"
                addKey="plan:quietHours.add"
                allocateId={allocatePeriodId}
                disabled={draft.quietHoursEnabled === YES_NO.NO}
                onChange={next => update('quietHours', next)}
              />
            </Box>
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DoNotDisturbOnOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Box>
                  <Typography>{t('plan:row.dndHours')}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    {t('plan:row.dndHoursHint')}
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={draft.dndHoursEnabled === YES_NO.YES}
                onChange={e => update('dndHoursEnabled', toYesNo(e.target.checked))}
              />
            </Box>
            <Box sx={{ pl: 4.25 }}>
              <PeriodListEditor
                periods={draft.dndHours}
                emptyKey="plan:dndHours.empty"
                addKey="plan:dndHours.add"
                allocateId={allocatePeriodId}
                disabled={draft.dndHoursEnabled === YES_NO.NO}
                onChange={next => update('dndHours', next)}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <Button onClick={handleReset} color="inherit">
          {t('plan:button.reset')}
        </Button>
        <Button onClick={handleCancel} disabled={!dirty} color="inherit">
          {t('plan:button.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!dirty} variant="contained">
          {t('plan:button.save')}
        </Button>
      </Box>
    </Box>
  );
}

export default PlanPage;
