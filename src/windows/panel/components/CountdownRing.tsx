import type { Phase } from '@src/shared/bindings';
import { Box, Typography, useTheme } from '@mui/material';
import { PHASE_RING_COLORS } from '../phaseColors';

interface CountdownRingProps {
  phase: Phase;
  displayTime: string;
  progress: number;
}

const SIZE = 120;
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownRing({ phase, displayTime, progress }: CountdownRingProps) {
  const theme = useTheme();
  const phaseColor = PHASE_RING_COLORS[phase];
  const progressColor = theme.palette.mode === 'light' ? phaseColor.light : phaseColor.dark;
  const clamped = Math.min(100, Math.max(0, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1, width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={theme.palette.divider}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={progressColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="h5"
          component="div"
          sx={{ fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}
        >
          {displayTime}
        </Typography>
      </Box>
    </Box>
  );
}
