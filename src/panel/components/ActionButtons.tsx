import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Divider, IconButton, Typography } from '@mui/material';

interface ActionButtonsProps {
  isPaused: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSettings: () => void;
}

export function ActionButtons({ isPaused, onToggle, onReset, onSettings }: ActionButtonsProps) {
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
          <IconButton aria-label={isPaused ? '恢复' : '暂停'} onClick={onToggle} size="small" color="secondary">
            {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {isPaused ? '恢复' : '暂停'}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label="重置计时器" onClick={onReset} size="small" color="secondary">
            <RestartAltIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            重置
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label="设置" onClick={onSettings} size="small" color="secondary">
            <SettingsIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            设置
          </Typography>
        </Box>
      </Box>
    </>
  );
}
