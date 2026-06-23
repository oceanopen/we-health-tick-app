import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import { Box, Button, Divider, Typography, useTheme } from '@mui/material';
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
    <>
      <Divider sx={{ width: '100%' }} />
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
        <PauseCircleFilledIcon sx={{ fontSize: 56, color: pausedColor }} />
        <Typography variant="h6" component="div">
          {title}
        </Typography>
        <Typography
          variant="body1"
          component="div"
          sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }}
        >
          {displayTime}
        </Typography>
        {quietTriggered && (
          <Typography variant="body2" align="center" color="text.secondary" sx={{ px: 1 }}>
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
    </>
  );
}
