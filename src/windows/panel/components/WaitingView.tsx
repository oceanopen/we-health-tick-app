import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface WaitingViewProps {
  isLongBreak: boolean;
  onReturn: () => void;
}

export function WaitingView({ isLongBreak, onReturn }: WaitingViewProps) {
  const { t } = useTranslation();
  // 刚结束那轮休息的类型（is_long_break 在进 Working 前不清零）区分标题。
  const waitingTitle = isLongBreak ? t('panel:longBreakOverTitle') : t('panel:waitingTitle');

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
      <Typography variant="subtitle1">
        {waitingTitle}
      </Typography>
      <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1 }}>
        {t('panel:waitingSubtitle')}
      </Typography>
      <Button variant="contained" fullWidth onClick={onReturn} sx={{ mt: 1, textTransform: 'none' }}>
        {t('panel:action.imBack')}
      </Button>
    </Box>
  );
}
