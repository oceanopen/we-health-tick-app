import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, IconButton, Typography } from '@mui/material';

interface ActionButtonsProps {
  isPaused: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSettings: () => void;
}

export function ActionButtons({ isPaused, onToggle, onReset, onSettings }: ActionButtonsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton aria-label={isPaused ? '恢复' : '暂停'} onClick={onToggle} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {isPaused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          {isPaused ? '恢复' : '暂停'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton aria-label="重置计时器" onClick={onReset} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <RestartAltIcon />
        </IconButton>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          重置
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton aria-label="设置" onClick={onSettings} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <SettingsIcon />
        </IconButton>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          设置
        </Typography>
      </Box>
    </Box>
  );
}
