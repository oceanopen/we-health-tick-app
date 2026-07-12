import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { Box, Button, IconButton, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PHASE_RING_COLORS } from '../phaseColors';

interface AlertingViewProps {
  whisperReminder: string;
  breakSkipCount: number;
  breakSkipMax: number;
  onStartBreak: () => void;
  onSkip: () => void;
}

export function AlertingView({ whisperReminder, breakSkipCount, breakSkipMax, onStartBreak, onSkip }: AlertingViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const alertingColor
    = theme.palette.mode === 'light' ? PHASE_RING_COLORS.alerting.light : PHASE_RING_COLORS.alerting.dark;
  const skipLabel = `${t('panel:action.skipBreak')} (${breakSkipCount}/${breakSkipMax})`;

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
      <NotificationsActiveIcon sx={{ fontSize: 120, color: alertingColor }} />
      <Typography variant="subtitle1">
        {t('panel:alertTitle')}
      </Typography>
      <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1 }}>
        {whisperReminder}
      </Typography>
      <Button variant="contained" fullWidth onClick={onStartBreak} sx={{ mt: 1, textTransform: 'none' }}>
        {t('panel:action.startBreak')}
      </Button>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton
          aria-label={skipLabel}
          onClick={onSkip}
          size="small"
          color="secondary"
          sx={{ 'opacity': 0.5, 'transition': 'opacity 0.2s', '&:hover': { opacity: 0.8 } }}
        >
          <SkipNextIcon />
        </IconButton>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          {skipLabel}
        </Typography>
      </Box>
    </Box>
  );
}
