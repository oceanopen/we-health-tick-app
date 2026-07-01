import { Box, Button, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface FooterActionsProps {
  onSettings: () => void;
  onRelaunch: () => void;
  onExit: () => void;
}

const buttonSx = { textTransform: 'none', fontSize: 10 } as const;

export function FooterActions({ onSettings, onRelaunch, onExit }: FooterActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Divider sx={{ width: '100%' }} />
      <Box sx={{ display: 'flex', width: '100%', gap: 0.5 }}>
        <Button onClick={onSettings} fullWidth size="small" color="secondary" sx={buttonSx}>
          {t('panel:action.settings')}
        </Button>
        <Button onClick={onRelaunch} fullWidth size="small" color="secondary" sx={buttonSx}>
          {t('panel:relaunch')}
        </Button>
        <Button onClick={onExit} fullWidth size="small" color="secondary" sx={buttonSx}>
          {t('panel:exit')}
        </Button>
      </Box>
    </>
  );
}
