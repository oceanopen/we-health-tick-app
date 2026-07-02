import type { QuietHourPeriod, QuietHours } from '@src/shared/config';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PHASE_RING_COLORS } from '../phaseColors';

interface PausedViewProps {
  remainingSeconds: number;
  quietTriggered: boolean;
  quietHours: QuietHours;
  onResume: () => void;
}

function formatHMS(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function findActiveQuietPeriod(periods: QuietHours, now: string): QuietHourPeriod | null {
  for (const p of periods) {
    if (p.start <= p.end) {
      if (p.start <= now && now < p.end) {
        return p;
      }
    } else if (now >= p.start || now < p.end) {
      return p;
    }
  }
  return null;
}

export function PausedView({ remainingSeconds, quietTriggered, quietHours, onResume }: PausedViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pausedColor
    = theme.palette.mode === 'light' ? PHASE_RING_COLORS.paused.light : PHASE_RING_COLORS.paused.dark;
  const title = quietTriggered ? t('panel:quietHoursActive') : t('panel:phasePaused');

  const activePeriod = quietTriggered ? findActiveQuietPeriod(quietHours, nowHHmm()) : null;
  const showQuietRange = activePeriod !== null;
  const displayText = activePeriod
    ? `${activePeriod.start}:00 - ${activePeriod.end}:00`
    : formatHMS(remainingSeconds);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        py: 1,
      }}
    >
      <PauseCircleFilledIcon sx={{ fontSize: 120, color: pausedColor }} />
      <Typography variant="subtitle1" component="div">
        {title}
      </Typography>
      <Typography
        variant="caption"
        component="div"
        align="center"
        color="text.secondary"
        sx={{ px: 1, fontVariantNumeric: 'tabular-nums' }}
      >
        {displayText}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1, opacity: 0.7 }}>
          {showQuietRange ? t('panel:quietHoursRangeLabel') : t('panel:resumableRemainingLabel')}
        </Typography>
        {quietTriggered && (
          <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1, opacity: 0.7 }}>
            {t('panel:pausedAutoResumeHint')}
          </Typography>
        )}
      </Box>
      <Button
        variant="contained"
        fullWidth
        onClick={onResume}
        disabled={quietTriggered}
        sx={{ mt: 1, textTransform: 'none' }}
      >
        {t('panel:action.resume')}
      </Button>
    </Box>
  );
}
