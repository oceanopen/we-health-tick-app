import InfoIcon from '@mui/icons-material/Info';
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
  breakPaused: boolean;
  onSkip: () => void;
}

export function BreakingView({
  displayTime,
  progress,
  reminder,
  isLongBreak,
  breakSkipCount,
  breakSkipMax,
  breakPaused,
  onSkip,
}: BreakingViewProps) {
  const { t } = useTranslation();
  const phaseLabel = isLongBreak ? t('panel:longBreakLabel') : t('panel:phaseBreaking');
  const skipLabel = `${t('panel:action.skipBreak')} (${breakSkipCount}/${breakSkipMax})`;

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
      <CountdownRing phase="breaking" displayTime={displayTime} progress={progress} />
      {breakPaused && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            width: '100%',
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            bgcolor: 'warning.main',
            color: 'warning.contrastText',
          }}
        >
          <InfoIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.3 }}>
            {t('panel:breakActivityPaused')}
          </Typography>
        </Box>
      )}
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
        <IconButton
          aria-label={skipLabel}
          onClick={onSkip}
          size="small"
          color="secondary"
          sx={{ 'opacity': 0.5, 'transition': 'opacity 0.2s', '&:hover': { opacity: 0.8 } }}
        >
          <SkipNextIcon />
        </IconButton>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          {skipLabel}
        </Typography>
      </Box>
    </Box>
  );
}
