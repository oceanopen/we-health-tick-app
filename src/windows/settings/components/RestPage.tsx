import type { SelectChangeEvent } from '@mui/material/Select';
import type { IdlePauseThreshold, PauseOnIdle, RestConfirm, RestWindow, SkipCountReminder } from '@src/shared/config';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
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
  DEFAULT_PAUSE_ON_IDLE,
  DEFAULT_REST_CONFIRM,
  DEFAULT_REST_WINDOW,
  DEFAULT_SKIP_COUNT_REMINDER,
  getConfig,
  IDLE_PAUSE_THRESHOLD_KEY,
  IDLE_PAUSE_THRESHOLD_STEP,
  MAX_BREAK_SKIP_MAX,
  MAX_IDLE_PAUSE_THRESHOLD,
  MAX_SKIP_COUNT_REMINDER,
  MIN_BREAK_SKIP_MAX,
  MIN_IDLE_PAUSE_THRESHOLD,
  MIN_SKIP_COUNT_REMINDER,
  parseYesNo,
  PAUSE_ON_IDLE_KEY,
  REST_CONFIRM_KEY,
  REST_WINDOW_KEY,
  setConfig,
  SKIP_COUNT_REMINDER_KEY,
  toYesNo,
  YES_NO,
} from '@src/shared/config';
import { restWindowOptions } from '@src/shared/settingOption';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RestConfig {
  restWindow: RestWindow;
  restConfirm: RestConfirm;
  skipCountReminder: SkipCountReminder;
  breakSkipMax: number;
  pauseOnIdle: PauseOnIdle;
  idlePauseThreshold: IdlePauseThreshold;
}

const DEFAULT_REST_CONFIG: RestConfig = {
  restWindow: DEFAULT_REST_WINDOW,
  restConfirm: DEFAULT_REST_CONFIRM,
  skipCountReminder: DEFAULT_SKIP_COUNT_REMINDER,
  breakSkipMax: DEFAULT_BREAK_SKIP_MAX,
  pauseOnIdle: DEFAULT_PAUSE_ON_IDLE,
  idlePauseThreshold: DEFAULT_IDLE_PAUSE_THRESHOLD,
};

function RestPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<RestConfig>(DEFAULT_REST_CONFIG);
  const [draft, setDraft] = useState<RestConfig>(DEFAULT_REST_CONFIG);

  useEffect(() => {
    Promise.all([
      getConfig(REST_WINDOW_KEY),
      getConfig(REST_CONFIRM_KEY),
      getConfig(SKIP_COUNT_REMINDER_KEY),
      getConfig(BREAK_SKIP_MAX_KEY),
      getConfig(PAUSE_ON_IDLE_KEY),
      getConfig(IDLE_PAUSE_THRESHOLD_KEY),
    ]).then(([window, confirm, skipCountReminder, bsm, poi, ipt]) => {
      const next: RestConfig = {
        restWindow:
          window === 'tray' || window === 'topRight' || window === 'fullscreen'
            ? window
            : DEFAULT_REST_WINDOW,
        restConfirm: parseYesNo(confirm, DEFAULT_REST_CONFIRM),
        skipCountReminder: decodeSkipCountReminder(skipCountReminder),
        breakSkipMax: bsm ? Number(bsm) : DEFAULT_BREAK_SKIP_MAX,
        pauseOnIdle: parseYesNo(poi, DEFAULT_PAUSE_ON_IDLE),
        idlePauseThreshold: decodeIdlePauseThreshold(ipt),
      };
      setSaved(next);
      setDraft(next);
    });
  }, []);

  const update = <K extends keyof RestConfig>(key: K, value: RestConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const dirty
    = saved.restWindow !== draft.restWindow
      || saved.restConfirm !== draft.restConfirm
      || saved.skipCountReminder !== draft.skipCountReminder
      || saved.breakSkipMax !== draft.breakSkipMax
      || saved.pauseOnIdle !== draft.pauseOnIdle
      || saved.idlePauseThreshold !== draft.idlePauseThreshold;

  const handleReset = () => setDraft(DEFAULT_REST_CONFIG);
  const handleCancel = () => setDraft(saved);

  const handleSave = async () => {
    await Promise.all([
      setConfig(REST_WINDOW_KEY, draft.restWindow),
      setConfig(REST_CONFIRM_KEY, draft.restConfirm),
      setConfig(SKIP_COUNT_REMINDER_KEY, String(draft.skipCountReminder)),
      setConfig(BREAK_SKIP_MAX_KEY, String(draft.breakSkipMax)),
      setConfig(PAUSE_ON_IDLE_KEY, draft.pauseOnIdle),
      setConfig(IDLE_PAUSE_THRESHOLD_KEY, String(draft.idlePauseThreshold)),
    ]);
    setSaved(draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {t('rest:page.title')}
        </Typography>

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
