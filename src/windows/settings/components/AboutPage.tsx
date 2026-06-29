import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DownloadIcon from '@mui/icons-material/Download';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import appIcon from '@src/assets/app-icon.png';
import { check } from '@tauri-apps/plugin-updater';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

declare const __APP_VERSION__: string;

// updater 检查与下载安装的状态机。
// idle/checking/up-to-date/error 为「检查」分支；
// available/downloading/downloaded 为「下载安装」分支。
// downloadAndInstall 完成后 plugin-updater 会自动重启应用，downloaded 仅作兜底显示。
type CheckState
  = | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'up-to-date' }
    | { kind: 'available'; update: Update }
    | { kind: 'downloading'; percent: number }
    | { kind: 'downloaded' }
    | { kind: 'error'; message: string };

function AboutPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  const handleCheck = async () => {
    // Update extends Resource，需显式 close 释放 Rust 端句柄。
    // 重新点「检查更新」时释放上一次的 Update，避免反复点击累积泄漏。
    if (state.kind === 'available') {
      await state.update.close().catch(() => {});
    }
    setState({ kind: 'checking' });
    try {
      const update = await check();
      if (update) {
        setState({ kind: 'available', update });
      } else {
        setState({ kind: 'up-to-date' });
      }
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleDownloadAndInstall = async (update: Update) => {
    setState({ kind: 'downloading', percent: 0 });
    let total = 0;
    let downloaded = 0;
    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (total > 0) {
              const percent = Math.min(100, Math.round((downloaded / total) * 100));
              setState({ kind: 'downloading', percent });
            }
            break;
          case 'Finished':
            break;
        }
      });
      // downloadAndInstall 完成后 plugin-updater 内部会触发重启；
      // 若未自动重启（如 macOS 极端情况），保留 downloaded 兜底状态。
      setState({ kind: 'downloaded' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const buttonProps = (() => {
    switch (state.kind) {
      case 'checking':
        return {
          label: t('about:checking'),
          icon: <CircularProgress size={16} />,
          disabled: true,
          onClick: undefined,
        };
      case 'available':
        return {
          label: t('about:downloadAndInstall', { version: state.update.version }),
          icon: <DownloadIcon />,
          disabled: false,
          onClick: () => handleDownloadAndInstall(state.update),
        };
      case 'downloading':
        return {
          label: t('about:downloading', { percent: state.percent }),
          icon: <CircularProgress size={16} />,
          disabled: true,
          onClick: undefined,
        };
      case 'downloaded':
        return {
          label: t('about:relaunch'),
          icon: <AutorenewIcon />,
          disabled: true,
          onClick: undefined,
        };
      case 'error':
        return {
          label: t('about:retry'),
          icon: <AutorenewIcon />,
          disabled: false,
          onClick: handleCheck,
        };
      case 'idle':
      case 'up-to-date':
      default:
        return {
          label: t('about:checkUpdate'),
          icon: <AutorenewIcon />,
          disabled: false,
          onClick: handleCheck,
        };
    }
  })();

  const statusText = (() => {
    switch (state.kind) {
      case 'up-to-date':
        return t('about:upToDate', { version: __APP_VERSION__ });
      case 'available':
        return t('about:updateAvailable', { version: state.update.version });
      case 'downloaded':
        return t('about:relaunch');
      case 'error':
        return t('about:checkFailed', { error: state.message });
      default:
        return null;
    }
  })();

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
        alt={t('common:brand')}
        sx={{
          width: 80,
          height: 80,
          borderRadius: 3,
          mb: 1,
        }}
      />

      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
        {t('common:brand')}
      </Typography>

      <Typography variant="body2" color="text.secondary">
        {t('about:subtitle')}
      </Typography>

      <Chip label={`v${__APP_VERSION__}`} size="small" />

      <Typography variant="body2" color="text.secondary">
        {t('about:slogan')}
      </Typography>

      <Button
        variant="outlined"
        size="small"
        startIcon={buttonProps.icon}
        disabled={buttonProps.disabled}
        sx={{ mt: 1, textTransform: 'none', minWidth: 160 }}
        onClick={buttonProps.onClick}
      >
        {buttonProps.label}
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 20 }}>
        {statusText ?? ''}
      </Typography>

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
          {t('about:madeWith')}
        </Typography>
        <FavoriteIcon sx={{ fontSize: 12, color: 'error.main' }} />
        <Typography variant="caption" color="text.secondary">
          {t('about:forHealth')}
        </Typography>
      </Box>
    </Box>
  );
}

export default AboutPage;
