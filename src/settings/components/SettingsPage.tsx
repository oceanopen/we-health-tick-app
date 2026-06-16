import type { SelectChangeEvent } from '@mui/material/Select';
import type { Appearance } from '../../shared/config';
import LanguageIcon from '@mui/icons-material/Language';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {

  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  getConfig,
  setConfig,
} from '../../shared/config';

type Language = 'system' | 'zh' | 'en';

const languageOptions: { value: Language; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

const appearanceOptions: { value: Appearance; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

function SettingsPage() {
  const [language, setLanguage] = useState<Language>('system');
  const [savedAppearance, setSavedAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [draftAppearance, setDraftAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    getConfig(APPEARANCE_KEY).then((v) => {
      if (v === 'system' || v === 'light' || v === 'dark') {
        setSavedAppearance(v);
        setDraftAppearance(v);
      }
    });
  }, []);

  const dirty = draftAppearance !== savedAppearance;

  const handleReset = () => setDraftAppearance(DEFAULT_APPEARANCE);
  const handleCancel = () => setDraftAppearance(savedAppearance);
  const handleSave = async () => {
    await setConfig(APPEARANCE_KEY, draftAppearance);
    setSavedAppearance(draftAppearance);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
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
                value={draftAppearance}
                onChange={(e: SelectChangeEvent<Appearance>) =>
                  setDraftAppearance(e.target.value as Appearance)}
              >
                {appearanceOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <Button onClick={handleReset} color="inherit">
          重置
        </Button>
        <Button onClick={handleCancel} disabled={!dirty} color="inherit">
          取消
        </Button>
        <Button onClick={handleSave} disabled={!dirty} variant="contained">
          保存
        </Button>
      </Box>
    </Box>
  );
}

export default SettingsPage;
