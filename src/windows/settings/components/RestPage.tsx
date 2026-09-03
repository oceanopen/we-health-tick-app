import type { SelectChangeEvent } from '@mui/material/Select';
import type { IdlePauseThreshold, PauseOnIdle, RestConfirm, RestEndConfirm, RestWindow, SkipBreakAllowed, SkipCountReminder, WorkActionBar } from '@src/shared/appConfig';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import SmartButtonOutlinedIcon from '@mui/icons-material/SmartButtonOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WeekendOutlinedIcon from '@mui/icons-material/WeekendOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  BREAK_SKIP_MAX_KEY,
  decodeIdlePauseThreshold,
  decodeSkipCountReminder,
  DEFAULT_BREAK_SKIP_MAX,
  DEFAULT_IDLE_PAUSE_THRESHOLD,
  DEFAULT_LONG_BREAK_WINDOW,
  DEFAULT_PAUSE_ON_IDLE,
  DEFAULT_QUIET_WINDOW,
  DEFAULT_REST_CONFIRM,
  DEFAULT_REST_END_CONFIRM,
  DEFAULT_REST_WINDOW,
  DEFAULT_SKIP_BREAK_ALLOWED,
  DEFAULT_SKIP_COUNT_REMINDER,
  DEFAULT_WORK_ACTION_BAR,
  getAppConfig,
  IDLE_PAUSE_THRESHOLD_KEY,
  IDLE_PAUSE_THRESHOLD_STEP,
  LONG_BREAK_WINDOW_KEY,
  MAX_BREAK_SKIP_MAX,
  MAX_IDLE_PAUSE_THRESHOLD,
  MAX_SKIP_COUNT_REMINDER,
  MIN_BREAK_SKIP_MAX,
  MIN_IDLE_PAUSE_THRESHOLD,
  MIN_SKIP_COUNT_REMINDER,
  parseYesNo,
  PAUSE_ON_IDLE_KEY,
  QUIET_WINDOW_KEY,
  REST_CONFIRM_KEY,
  REST_END_CONFIRM_KEY,
  REST_WINDOW_KEY,
  setAppConfig,
  SKIP_BREAK_ALLOWED_KEY,
  SKIP_COUNT_REMINDER_KEY,
  toYesNo,
  WORK_ACTION_BAR_KEY,
  YES_NO,
} from '@src/shared/appConfig';
import { restWindowOptions } from '@src/shared/settingOption';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AppRestConfig {
  restWindow: RestWindow;
  longBreakWindow: RestWindow;
  quietWindow: RestWindow;
  workActionBar: WorkActionBar;
  restConfirm: RestConfirm;
  restEndConfirm: RestEndConfirm;
  skipBreakAllowed: SkipBreakAllowed;
  skipCountReminder: SkipCountReminder;
  breakSkipMax: number;
  pauseOnIdle: PauseOnIdle;
  idlePauseThreshold: IdlePauseThreshold;
}

function isRestWindow(value: string | null): value is RestWindow {
  return value === 'tray' || value === 'topRight' || value === 'fullscreen';
}

const DEFAULT_APP_REST_CONFIG: AppRestConfig = {
  restWindow: DEFAULT_REST_WINDOW,
  longBreakWindow: DEFAULT_LONG_BREAK_WINDOW,
  quietWindow: DEFAULT_QUIET_WINDOW,
  workActionBar: DEFAULT_WORK_ACTION_BAR,
  restConfirm: DEFAULT_REST_CONFIRM,
  restEndConfirm: DEFAULT_REST_END_CONFIRM,
  skipBreakAllowed: DEFAULT_SKIP_BREAK_ALLOWED,
  skipCountReminder: DEFAULT_SKIP_COUNT_REMINDER,
  breakSkipMax: DEFAULT_BREAK_SKIP_MAX,
  pauseOnIdle: DEFAULT_PAUSE_ON_IDLE,
  idlePauseThreshold: DEFAULT_IDLE_PAUSE_THRESHOLD,
};

function RestPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<AppRestConfig>(DEFAULT_APP_REST_CONFIG);
  const [draft, setDraft] = useState<AppRestConfig>(DEFAULT_APP_REST_CONFIG);

  useEffect(() => {
    Promise.all([
      getAppConfig(REST_WINDOW_KEY),
      getAppConfig(LONG_BREAK_WINDOW_KEY),
      getAppConfig(QUIET_WINDOW_KEY),
      getAppConfig(WORK_ACTION_BAR_KEY),
      getAppConfig(REST_CONFIRM_KEY),
      getAppConfig(REST_END_CONFIRM_KEY),
      getAppConfig(SKIP_BREAK_ALLOWED_KEY),
      getAppConfig(SKIP_COUNT_REMINDER_KEY),
      getAppConfig(BREAK_SKIP_MAX_KEY),
      getAppConfig(PAUSE_ON_IDLE_KEY),
      getAppConfig(IDLE_PAUSE_THRESHOLD_KEY),
    ]).then(([window, longBreakWindow, quietWindow, wab, confirm, rec, sba, skipCountReminder, bsm, poi, ipt]) => {
      const next: AppRestConfig = {
        restWindow: isRestWindow(window) ? window : DEFAULT_REST_WINDOW,
        longBreakWindow: isRestWindow(longBreakWindow)
          ? longBreakWindow
          : DEFAULT_LONG_BREAK_WINDOW,
        quietWindow: isRestWindow(quietWindow) ? quietWindow : DEFAULT_QUIET_WINDOW,
        workActionBar: parseYesNo(wab, DEFAULT_WORK_ACTION_BAR),
        restConfirm: parseYesNo(confirm, DEFAULT_REST_CONFIRM),
        restEndConfirm: parseYesNo(rec, DEFAULT_REST_END_CONFIRM),
        skipBreakAllowed: parseYesNo(sba, DEFAULT_SKIP_BREAK_ALLOWED),
        skipCountReminder: decodeSkipCountReminder(skipCountReminder),
        breakSkipMax: bsm ? Number(bsm) : DEFAULT_BREAK_SKIP_MAX,
        pauseOnIdle: parseYesNo(poi, DEFAULT_PAUSE_ON_IDLE),
        idlePauseThreshold: decodeIdlePauseThreshold(ipt),
      };
      setSaved(next);
      setDraft(next);
    });
  }, []);

  const update = <K extends keyof AppRestConfig>(key: K, value: AppRestConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const dirty
    = saved.restWindow !== draft.restWindow
      || saved.longBreakWindow !== draft.longBreakWindow
      || saved.quietWindow !== draft.quietWindow
      || saved.workActionBar !== draft.workActionBar
      || saved.restConfirm !== draft.restConfirm
      || saved.restEndConfirm !== draft.restEndConfirm
      || saved.skipBreakAllowed !== draft.skipBreakAllowed
      || saved.skipCountReminder !== draft.skipCountReminder
      || saved.breakSkipMax !== draft.breakSkipMax
      || saved.pauseOnIdle !== draft.pauseOnIdle
      || saved.idlePauseThreshold !== draft.idlePauseThreshold;

  const handleReset = () => setDraft(DEFAULT_APP_REST_CONFIG);
  const handleCancel = () => setDraft(saved);

  const handleSave = async () => {
    await Promise.all([
      setAppConfig(REST_WINDOW_KEY, draft.restWindow),
      setAppConfig(LONG_BREAK_WINDOW_KEY, draft.longBreakWindow),
      setAppConfig(QUIET_WINDOW_KEY, draft.quietWindow),
      setAppConfig(WORK_ACTION_BAR_KEY, draft.workActionBar),
      setAppConfig(REST_CONFIRM_KEY, draft.restConfirm),
      setAppConfig(REST_END_CONFIRM_KEY, draft.restEndConfirm),
      setAppConfig(SKIP_BREAK_ALLOWED_KEY, draft.skipBreakAllowed),
      setAppConfig(SKIP_COUNT_REMINDER_KEY, String(draft.skipCountReminder)),
      setAppConfig(BREAK_SKIP_MAX_KEY, String(draft.breakSkipMax)),
      setAppConfig(PAUSE_ON_IDLE_KEY, draft.pauseOnIdle),
      setAppConfig(IDLE_PAUSE_THRESHOLD_KEY, String(draft.idlePauseThreshold)),
    ]);
    setSaved(draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
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
              <WeekendOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.restWindow')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={draft.restWindow}
                onChange={(e: SelectChangeEvent<RestWindow>) =>
                  update('restWindow', e.target.value as RestWindow)}
              >
                {restWindowOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
              <Typography>{t('rest:row.longBreakWindow')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={draft.longBreakWindow}
                onChange={(e: SelectChangeEvent<RestWindow>) =>
                  update('longBreakWindow', e.target.value as RestWindow)}
              >
                {restWindowOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
              <NightsStayOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.quietWindow')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={draft.quietWindow}
                onChange={(e: SelectChangeEvent<RestWindow>) =>
                  update('quietWindow', e.target.value as RestWindow)}
              >
                {restWindowOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
              <SmartButtonOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography>{t('rest:row.workActionBar')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {t('rest:row.workActionBarHint')}
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={draft.workActionBar === YES_NO.YES}
              onChange={e => update('workActionBar', toYesNo(e.target.checked))}
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
              <HelpOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.restConfirm')}</Typography>
            </Box>
            <Switch
              checked={draft.restConfirm === YES_NO.YES}
              onChange={e => update('restConfirm', toYesNo(e.target.checked))}
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
              <ReplayOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.restEndConfirm')}</Typography>
            </Box>
            <Switch
              checked={draft.restEndConfirm === YES_NO.YES}
              onChange={e => update('restEndConfirm', toYesNo(e.target.checked))}
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
              <BlockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.skipBreakAllowed')}</Typography>
            </Box>
            <Switch
              checked={draft.skipBreakAllowed === YES_NO.YES}
              onChange={e => update('skipBreakAllowed', toYesNo(e.target.checked))}
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
              <SkipNextOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography>{t('rest:row.breakSkipMax')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {t('rest:row.breakSkipMaxHint')}
                </Typography>
              </Box>
            </Box>
            <TextField
              type="number"
              size="small"
              value={draft.breakSkipMax}
              slotProps={{ htmlInput: { min: MIN_BREAK_SKIP_MAX, max: MAX_BREAK_SKIP_MAX, step: 1 } }}
              onChange={(e) => {
                const n = Number(e.target.value);
                update(
                  'breakSkipMax',
                  Number.isFinite(n)
                    ? Math.min(MAX_BREAK_SKIP_MAX, Math.max(MIN_BREAK_SKIP_MAX, Math.trunc(n)))
                    : DEFAULT_BREAK_SKIP_MAX,
                );
              }}
              sx={{ width: 100 }}
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
              <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography>{t('rest:row.skipCountReminder')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {t('rest:row.skipCountReminderHint')}
                </Typography>
              </Box>
            </Box>
            <TextField
              type="number"
              size="small"
              value={draft.skipCountReminder}
              slotProps={{ htmlInput: { min: MIN_SKIP_COUNT_REMINDER, max: MAX_SKIP_COUNT_REMINDER, step: 1 } }}
              onChange={(e) => {
                const n = Number(e.target.value);
                update(
                  'skipCountReminder',
                  Number.isFinite(n)
                    ? Math.min(MAX_SKIP_COUNT_REMINDER, Math.max(MIN_SKIP_COUNT_REMINDER, Math.trunc(n)))
                    : DEFAULT_SKIP_COUNT_REMINDER,
                );
              }}
              sx={{ width: 100 }}
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
              <PauseCircleOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography>{t('rest:row.pauseOnIdle')}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {t('rest:row.pauseOnIdleHint')}
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={draft.pauseOnIdle === YES_NO.YES}
              onChange={e => update('pauseOnIdle', toYesNo(e.target.checked))}
            />
          </Box>
          {draft.pauseOnIdle === YES_NO.YES && (
            <Box sx={{ pl: 4.25, pr: 2, py: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('rest:row.idlePauseThreshold')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {draft.idlePauseThreshold}
                  {' '}
                  {t('rest:unit.seconds')}
                </Typography>
              </Box>
              <Slider
                value={draft.idlePauseThreshold}
                onChange={(_, v) => update('idlePauseThreshold', v as number)}
                min={MIN_IDLE_PAUSE_THRESHOLD}
                max={MAX_IDLE_PAUSE_THRESHOLD}
                step={IDLE_PAUSE_THRESHOLD_STEP}
                size="small"
              />
            </Box>
          )}
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
          {t('rest:button.reset')}
        </Button>
        <Button onClick={handleCancel} disabled={!dirty} color="inherit">
          {t('rest:button.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!dirty} variant="contained">
          {t('rest:button.save')}
        </Button>
      </Box>
    </Box>
  );
}

export default RestPage;
