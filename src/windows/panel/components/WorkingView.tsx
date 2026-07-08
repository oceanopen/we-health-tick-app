import LocalCafeOutlinedIcon from '@mui/icons-material/LocalCafeOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import { Box, Divider, IconButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CountdownRing } from './CountdownRing';

interface WorkingViewProps {
  displayTime: string;
  progress: number;
  isPaused: boolean;
  onToggle: () => void;
  onReset: () => void;
  onManualBreak: () => void;
}

export function WorkingView({
  displayTime,
  progress,
  isPaused,
  onToggle,
  onReset,
  onManualBreak,
}: WorkingViewProps) {
  const { t } = useTranslation();
  const toggleLabel = isPaused ? t('panel:action.resume') : t('panel:action.pause');

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
      <CountdownRing phase="working" displayTime={displayTime} progress={progress} />
      <Typography variant="subtitle1">
        {t('panel:phaseWorking')}
      </Typography>
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
          <IconButton aria-label={t('panel:action.reset')} onClick={onReset} size="small" color="secondary">
            <ReplayIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('panel:action.reset')}
          </Typography>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton aria-label={t('panel:action.manualBreak')} onClick={onManualBreak} size="small" color="secondary">
            <LocalCafeOutlinedIcon />
          </IconButton>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('panel:action.manualBreak')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
