import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PHASE_RING_COLORS } from '../phaseColors';

interface AlertingViewProps {
  reminder: string;
  onStartBreak: () => void;
}

export function AlertingView({ reminder, onStartBreak }: AlertingViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const alertingColor
    = theme.palette.mode === 'light' ? PHASE_RING_COLORS.alerting.light : PHASE_RING_COLORS.alerting.dark;

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
        {reminder}
      </Typography>
      <Button variant="contained" fullWidth onClick={onStartBreak} sx={{ mt: 1, textTransform: 'none' }}>
        {t('panel:action.startBreak')}
      </Button>
    </Box>
  );
}
