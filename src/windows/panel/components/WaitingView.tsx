import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Button, Divider, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface WaitingViewProps {
  onReturn: () => void;
}

export function WaitingView({ onReturn }: WaitingViewProps) {
  const { t } = useTranslation();

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
        <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
        <Typography variant="h6" component="div">
          {t('panel:waitingTitle')}
        </Typography>
        <Typography
          variant="body1"
          component="div"
          align="center"
          color="text.secondary"
          sx={{ px: 1 }}
        >
          {t('panel:waitingSubtitle')}
        </Typography>
        <Button variant="contained" fullWidth onClick={onReturn} sx={{ mt: 1, textTransform: 'none' }}>
          {t('panel:action.imBack')}
        </Button>
      </Box>
    </>
  );
}
