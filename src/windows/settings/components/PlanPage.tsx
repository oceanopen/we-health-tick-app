import type { SelectChangeEvent } from '@mui/material/Select';
import type { LongBreakEnabled, QuietHourPeriod } from '@src/shared/config';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AvTimerOutlinedIcon from '@mui/icons-material/AvTimerOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  BREAK_DURATION_KEY,
  decodeQuietHours,
  DEFAULT_BREAK_DURATION,
  DEFAULT_LONG_BREAK_DURATION,
  DEFAULT_LONG_BREAK_ENABLED,
  DEFAULT_LONG_BREAK_INTERVAL,
  DEFAULT_QUIET_HOURS,
  DEFAULT_WORK_DURATION,
  DEFAULT_WORK_END_TIME,
  DEFAULT_WORK_START_TIME,
  encodeQuietHours,
  getConfig,
  LONG_BREAK_DURATION_KEY,
  LONG_BREAK_ENABLED_KEY,
  LONG_BREAK_INTERVAL_KEY,
  parseYesNo,
  QUIET_HOURS_KEY,
  setConfig,
  toYesNo,
  WORK_DURATION_KEY,
  WORK_END_TIME_KEY,
  WORK_START_TIME_KEY,
  YES_NO,
} from '@src/shared/config';
import { longBreakIntervalOptions } from '@src/shared/settingOption';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface QuietHourItem extends QuietHourPeriod {
  id: number;
}

interface PlanConfig {
  workDuration: number;
  breakDuration: number;
  longBreakEnabled: LongBreakEnabled;
  longBreakInterval: number;
  longBreakDuration: number;
  workStartTime: string;
  workEndTime: string;
  quietHours: QuietHourItem[];
}

const DEFAULT_PLAN_CONFIG: PlanConfig = {
  workDuration: DEFAULT_WORK_DURATION,
  breakDuration: DEFAULT_BREAK_DURATION,
  longBreakEnabled: DEFAULT_LONG_BREAK_ENABLED,
  longBreakInterval: DEFAULT_LONG_BREAK_INTERVAL,
  longBreakDuration: DEFAULT_LONG_BREAK_DURATION,
  workStartTime: DEFAULT_WORK_START_TIME,
  workEndTime: DEFAULT_WORK_END_TIME,
  quietHours: DEFAULT_QUIET_HOURS.map((p, i) => ({ ...p, id: i + 1 })),
};

function PlanPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const [draft, setDraft] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);
  const quietHourIdRef = useRef(DEFAULT_PLAN_CONFIG.quietHours.length);

  const allocateQuietHourId = () => {
    quietHourIdRef.current += 1;
    return quietHourIdRef.current;
  };

  useEffect(() => {
    Promise.all([
      getConfig(WORK_DURATION_KEY),
      getConfig(BREAK_DURATION_KEY),
      getConfig(LONG_BREAK_ENABLED_KEY),
      getConfig(LONG_BREAK_INTERVAL_KEY),
      getConfig(LONG_BREAK_DURATION_KEY),
      getConfig(WORK_START_TIME_KEY),
      getConfig(WORK_END_TIME_KEY),
      getConfig(QUIET_HOURS_KEY),
    ]).then(([wd, bd, lbe, lbi, lbdu, wst, wet, qh]) => {
      const next: PlanConfig = {
        workDuration: wd ? Number(wd) : DEFAULT_WORK_DURATION,
        breakDuration: bd ? Number(bd) : DEFAULT_BREAK_DURATION,
        longBreakEnabled: parseYesNo(lbe, DEFAULT_LONG_BREAK_ENABLED),
        longBreakInterval: lbi ? Number(lbi) : DEFAULT_LONG_BREAK_INTERVAL,
        longBreakDuration: lbdu ? Number(lbdu) : DEFAULT_LONG_BREAK_DURATION,
        workStartTime: wst ?? DEFAULT_WORK_START_TIME,
        workEndTime: wet ?? DEFAULT_WORK_END_TIME,
        quietHours: decodeQuietHours(qh).map(p => ({ ...p, id: allocateQuietHourId() })),
      };
      setSaved(next);
      setDraft(next);
    });
  }, []);

  const update = <K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const updateQuietHour = (
    index: number,
    field: keyof QuietHourPeriod,
    value: string,
  ) => {
    setDraft(prev => ({
      ...prev,
      quietHours: prev.quietHours.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    }));
  };

  const addQuietHour = () => {
    setDraft(prev => ({
      ...prev,
      quietHours: [
        ...prev.quietHours,
        { id: allocateQuietHourId(), start: '12:00', end: '13:00' },
      ],
    }));
  };

  const removeQuietHour = (index: number) => {
    setDraft(prev => ({
      ...prev,
      quietHours: prev.quietHours.filter((_, i) => i !== index),
    }));
  };

  const dirty
    = saved.workDuration !== draft.workDuration
      || saved.breakDuration !== draft.breakDuration
      || saved.longBreakEnabled !== draft.longBreakEnabled
      || saved.longBreakInterval !== draft.longBreakInterval
      || saved.longBreakDuration !== draft.longBreakDuration
      || saved.workStartTime !== draft.workStartTime
      || saved.workEndTime !== draft.workEndTime
      || JSON.stringify(saved.quietHours) !== JSON.stringify(draft.quietHours);

  const handleReset = () => setDraft(DEFAULT_PLAN_CONFIG);
  const handleCancel = () => setDraft(saved);

  const handleSave = async () => {
    await Promise.all([
      setConfig(WORK_DURATION_KEY, String(draft.workDuration)),
      setConfig(BREAK_DURATION_KEY, String(draft.breakDuration)),
      setConfig(LONG_BREAK_ENABLED_KEY, draft.longBreakEnabled),
      setConfig(LONG_BREAK_INTERVAL_KEY, String(draft.longBreakInterval)),
      setConfig(LONG_BREAK_DURATION_KEY, String(draft.longBreakDuration)),
      setConfig(WORK_START_TIME_KEY, draft.workStartTime),
      setConfig(WORK_END_TIME_KEY, draft.workEndTime),
      setConfig(
        QUIET_HOURS_KEY,
        encodeQuietHours(draft.quietHours.map(({ id: _id, ...rest }) => rest)),
      ),
    ]);
    setSaved(draft);
  };

  const timeInputSx = { width: 120 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {t('plan:page.title')}
        </Typography>

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
              min={15}
              max={120}
              step={5}
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
              min={5}
              max={30}
              step={5}
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
              <ScheduleOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('plan:row.workTime')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                type="time"
                size="small"
                value={draft.workStartTime}
                onChange={e => update('workStartTime', e.target.value)}
                sx={timeInputSx}
              />
              <Typography color="text.secondary">—</Typography>
              <TextField
                type="time"
                size="small"
                value={draft.workEndTime}
                onChange={e => update('workEndTime', e.target.value)}
                sx={timeInputSx}
              />
            </Box>
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <NightsStayOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('plan:row.quietHours')}</Typography>
            </Box>
            <Box sx={{ pl: 4.25 }}>
              {draft.quietHours.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                  {t('plan:quietHours.empty')}
                </Typography>
              )}
              {draft.quietHours.map((p, i) => (
                <Box
                  key={p.id}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <TextField
                    type="time"
                    size="small"
                    value={p.start}
                    onChange={e => updateQuietHour(i, 'start', e.target.value)}
                    sx={timeInputSx}
                  />
                  <Typography color="text.secondary">—</Typography>
                  <TextField
                    type="time"
                    size="small"
                    value={p.end}
                    onChange={e => updateQuietHour(i, 'end', e.target.value)}
                    sx={timeInputSx}
                  />
                  <IconButton size="small" onClick={() => removeQuietHour(i)}>
                    <CloseOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddOutlinedIcon />}
                onClick={addQuietHour}
                color="inherit"
              >
                {t('plan:quietHours.add')}
              </Button>
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
