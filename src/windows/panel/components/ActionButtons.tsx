import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Divider, IconButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ActionButtonsProps {
  isPaused: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSettings: () => void;
}

export function ActionButtons({ isPaused, onToggle, onReset, onSettings }: ActionButtonsProps) {
  const { t } = useTranslation();
  const toggleLabel = isPaused ? t('panel:action.resume') : t('panel:action.pause');

  return (
    <>
      <Divider sx={{ width: '100%' }} />
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          px: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label={toggleLabel} onClick={onToggle} size="small" color="secondary">
            {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {toggleLabel}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label={t('panel:action.resetTimerAria')} onClick={onReset} size="small" color="secondary">
            <RestartAltIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('panel:action.reset')}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label={t('panel:action.settings')} onClick={onSettings} size="small" color="secondary">
            <SettingsIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('panel:action.settings')}
          </Typography>
        </Box>
      </Box>
    </>
  );
}
