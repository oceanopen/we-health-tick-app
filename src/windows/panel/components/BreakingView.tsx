import SkipNextIcon from '@mui/icons-material/SkipNext';
import { Box, Divider, IconButton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CountdownRing } from './CountdownRing';

interface BreakingViewProps {
  displayTime: string;
  progress: number;
  reminder: string;
  isLongBreak: boolean;
  breakSkipCount: number;
  breakSkipMax: number;
  onSkip: () => void;
}

export function BreakingView({
  displayTime,
  progress,
  reminder,
  isLongBreak,
  breakSkipCount,
  breakSkipMax,
  onSkip,
}: BreakingViewProps) {
  const { t } = useTranslation();
  const phaseLabel = isLongBreak ? t('panel:longBreakLabel') : t('panel:phaseBreaking');
  const skipLabel = `${t('panel:action.skipBreak')} (${breakSkipCount}/${breakSkipMax})`;

  return (
    <>
      <CountdownRing phase="breaking" displayTime={displayTime} progress={progress} />
      <Typography variant="subtitle1">
        {phaseLabel}
      </Typography>
      {reminder && (
        <Typography variant="caption" align="center" color="text.secondary" sx={{ px: 1 }}>
          {reminder}
        </Typography>
      )}
      <Divider sx={{ width: '100%' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton aria-label={skipLabel} onClick={onSkip} size="small" color="secondary">
          <SkipNextIcon />
        </IconButton>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          {skipLabel}
        </Typography>
      </Box>
    </>
  );
}
