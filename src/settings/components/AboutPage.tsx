import AutorenewIcon from '@mui/icons-material/Autorenew';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { Box, Button, Chip, Typography } from '@mui/material';
import appIcon from '../../assets/app-icon.png';

declare const __APP_VERSION__: string;

function AboutPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 1.5,
        px: 3,
        py: 4,
      }}
    >
      <Box
        component="img"
        src={appIcon}
        alt="We Health Tick"
        sx={{
          width: 80,
          height: 80,
          borderRadius: 3,
          mb: 1,
        }}
      />

      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
        We Health Tick
      </Typography>

      <Typography variant="body2" color="text.secondary">
        健康打卡
      </Typography>

      <Chip label={`v${__APP_VERSION__}`} size="small" />

      <Typography variant="body2" color="text.secondary">
        久坐提醒 · 强制休息 · 习惯养成
      </Typography>

      <Button
        variant="outlined"
        size="small"
        startIcon={<AutorenewIcon />}
        sx={{ mt: 1, textTransform: 'none' }}
      >
        检查更新
      </Button>

      <Typography
        component="a"
        role="button"
        variant="body2"
        color="primary"
        sx={{
          'textDecoration': 'none',
          'cursor': 'pointer',
          '&:hover': { textDecoration: 'underline' },
          'mt': 1,
        }}
        onClick={() => {
          import('@tauri-apps/plugin-shell').then(({ open }) => {
            open('https://github.com/oceanopen/we-health-tick-app');
          });
        }}
      >
        GitHub
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto', pt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Made with
        </Typography>
        <FavoriteIcon sx={{ fontSize: 12, color: 'error.main' }} />
        <Typography variant="caption" color="text.secondary">
          for your health
        </Typography>
      </Box>
    </Box>
  );
}

export default AboutPage;
