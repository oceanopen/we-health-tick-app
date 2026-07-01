import AutorenewIcon from '@mui/icons-material/Autorenew';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Box, Button, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface FooterActionsProps {
  onSettings: () => void;
  onRelaunch: () => void;
  onExit: () => void;
}

// 覆盖 MUI Button 内部 `.MuiButton-startIcon > *:nth-of-type(1)` 的硬编码 font-size（size="small" 时计算值 18px），
// 否则直接给 SvgIcon 传 sx fontSize 会被该 selector 覆盖（见 mui/material-ui#28917）。
const buttonSx = {
  'textTransform': 'none',
  'fontSize': 10,
  '& .MuiButton-startIcon': { marginRight: '4px' },
  '& .MuiButton-startIcon .MuiSvgIcon-root': { fontSize: 14 },
} as const;

export function FooterActions({ onSettings, onRelaunch, onExit }: FooterActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Divider sx={{ width: '100%' }} />
      <Box sx={{ display: 'flex', width: '100%', gap: 0.5 }}>
        <Button
          onClick={onSettings}
          fullWidth
          size="small"
          color="secondary"
          sx={buttonSx}
          startIcon={<SettingsOutlinedIcon />}
        >
          {t('panel:action.settings')}
        </Button>
        <Button
          onClick={onRelaunch}
          fullWidth
          size="small"
          color="secondary"
          sx={buttonSx}
          startIcon={<AutorenewIcon />}
        >
          {t('panel:relaunch')}
        </Button>
        <Button
          onClick={onExit}
          fullWidth
          size="small"
          color="secondary"
          sx={buttonSx}
          startIcon={<LogoutIcon />}
        >
          {t('panel:exit')}
        </Button>
      </Box>
    </>
  );
}
