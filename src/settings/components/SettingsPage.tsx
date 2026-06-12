import LanguageIcon from '@mui/icons-material/Language';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import {
  Box,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useState } from 'react';

type Language = 'system' | 'zh' | 'en';
type ThemeMode = 'system' | 'light' | 'dark';

const languageOptions: { value: Language; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

function SettingsPage() {
  const [language, setLanguage] = useState<Language>('system');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        系统设置
      </Typography>

      <Box
        sx={{
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LanguageIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography>语言</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={language}
              onChange={e => setLanguage(e.target.value as Language)}
            >
              {languageOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PaletteOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography>外观</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={themeMode}
              onChange={e => setThemeMode(e.target.value as ThemeMode)}
            >
              {themeOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Box>
  );
}

export default SettingsPage;
