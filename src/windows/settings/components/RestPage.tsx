import type { SelectChangeEvent } from '@mui/material/Select';
import type { RestConfirm, RestWindow } from '@src/shared/config';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import WeekendOutlinedIcon from '@mui/icons-material/WeekendOutlined';
import {
  Box,
  Button,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@mui/material';
import {
  DEFAULT_REST_CONFIRM,
  DEFAULT_REST_WINDOW,
  getConfig,
  parseYesNo,
  REST_CONFIRM_KEY,
  REST_WINDOW_KEY,
  setConfig,
  toYesNo,
  YES_NO,
} from '@src/shared/config';
import { restWindowOptions } from '@src/shared/settingOption';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RestConfig {
  restWindow: RestWindow;
  restConfirm: RestConfirm;
}

const DEFAULT_REST_CONFIG: RestConfig = {
  restWindow: DEFAULT_REST_WINDOW,
  restConfirm: DEFAULT_REST_CONFIRM,
};

function RestPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<RestConfig>(DEFAULT_REST_CONFIG);
  const [draft, setDraft] = useState<RestConfig>(DEFAULT_REST_CONFIG);

  useEffect(() => {
    Promise.all([
      getConfig(REST_WINDOW_KEY),
      getConfig(REST_CONFIRM_KEY),
    ]).then(([window, confirm]) => {
      const next: RestConfig = {
        restWindow:
          window === 'tray' || window === 'topRight' || window === 'fullscreen'
            ? window
            : DEFAULT_REST_WINDOW,
        restConfirm: parseYesNo(confirm, DEFAULT_REST_CONFIRM),
      };
      setSaved(next);
      setDraft(next);
    });
  }, []);

  const update = <K extends keyof RestConfig>(key: K, value: RestConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const dirty
    = saved.restWindow !== draft.restWindow || saved.restConfirm !== draft.restConfirm;

  const handleReset = () => setDraft(DEFAULT_REST_CONFIG);
  const handleCancel = () => setDraft(saved);

  const handleSave = async () => {
    await Promise.all([
      setConfig(REST_WINDOW_KEY, draft.restWindow),
      setConfig(REST_CONFIRM_KEY, draft.restConfirm),
    ]);
    setSaved(draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {t('rest:page.title')}
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
              <WeekendOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.restWindow')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={draft.restWindow}
                onChange={(e: SelectChangeEvent<RestWindow>) =>
                  update('restWindow', e.target.value as RestWindow)}
              >
                {restWindowOptions.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
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
              <HelpOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography>{t('rest:row.restConfirm')}</Typography>
            </Box>
            <Switch
              checked={draft.restConfirm === YES_NO.YES}
              onChange={e => update('restConfirm', toYesNo(e.target.checked))}
            />
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
          {t('rest:button.reset')}
        </Button>
        <Button onClick={handleCancel} disabled={!dirty} color="inherit">
          {t('rest:button.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!dirty} variant="contained">
          {t('rest:button.save')}
        </Button>
      </Box>
    </Box>
  );
}

export default RestPage;
