import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface WaitingViewProps {
  onReturn: () => void;
}

export function WaitingView({ onReturn }: WaitingViewProps) {
  const { t } = useTranslation();

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
      <CheckCircleIcon sx={{ fontSize: 120, color: 'success.main' }} />
      <Typography variant="body2" color="text.secondary">
        {t('panel:waitingTitle')}
      </Typography>
      <Typography variant="body2" align="center" sx={{ fontStyle: 'italic', color: 'text.secondary', px: 1 }}>
        {t('panel:waitingSubtitle')}
      </Typography>
      <Button variant="contained" fullWidth onClick={onReturn} sx={{ mt: 1, textTransform: 'none' }}>
        {t('panel:action.imBack')}
      </Button>
    </Box>
  );
}
