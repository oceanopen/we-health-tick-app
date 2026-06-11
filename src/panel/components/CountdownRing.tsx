import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

interface CountdownRingProps {
  displayTime: string;
  progress: number;
  isExpired: boolean;
}

export function CountdownRing({ displayTime, progress, isExpired }: CountdownRingProps) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={120}
        thickness={3}
        sx={{ color: 'rgba(255,255,255,0.1)', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={isExpired ? 0 : progress}
        size={120}
        thickness={3}
        sx={{
          color: isExpired ? 'grey.500' : '#c084fc',
          transition: 'color 0.3s',
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
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
