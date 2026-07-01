import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PHASE_RING_COLORS } from '../phaseColors';

interface PausedViewProps {
  displayTime: string;
  quietTriggered: boolean;
  onResume: () => void;
}

export function PausedView({ displayTime, quietTriggered, onResume }: PausedViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pausedColor
    = theme.palette.mode === 'light' ? PHASE_RING_COLORS.paused.light : PHASE_RING_COLORS.paused.dark;
  const title = quietTriggered ? t('panel:quietHoursActive') : t('panel:phasePaused');

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
        {displayTime}
      </Typography>
      {quietTriggered && (
        <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1 }}>
          {t('panel:pausedAutoResumeHint')}
        </Typography>
      )}
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
