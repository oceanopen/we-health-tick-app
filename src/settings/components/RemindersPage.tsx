import type { TFunction } from 'i18next';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  decodeReminders,
  encodeReminders,
  getConfig,
  REMINDERS_KEY,
  setConfig,
} from '../../shared/config';

interface ReminderItem {
  id: number;
  text: string;
}

interface RemindersConfig {
  reminders: ReminderItem[];
}

const MAX_REMINDER_LENGTH = 500;

function isInvalidReminder(text: string): boolean {
  return text.trim() === '' || text.length > MAX_REMINDER_LENGTH;
}

function buildDefaultReminders(t: TFunction): ReminderItem[] {
  return [
    { id: 1, text: t('reminders:defaultMessage.walk') },
    { id: 2, text: t('reminders:defaultMessage.water') },
  ];
}

function RemindersPage() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<RemindersConfig>(() => ({
    reminders: buildDefaultReminders(t),
  }));
  const [draft, setDraft] = useState<RemindersConfig>(() => ({
    reminders: buildDefaultReminders(t),
  }));
  const [hasValidationAttempted, setHasValidationAttempted] = useState(false);
  const reminderIdRef = useRef(2);

  const allocateReminderId = () => {
    reminderIdRef.current += 1;
    return reminderIdRef.current;
  };

  useEffect(() => {
    getConfig(REMINDERS_KEY).then((raw) => {
      const decoded = decodeReminders(raw);
      const items
        = decoded.length > 0
          ? decoded.map(text => ({ id: allocateReminderId(), text }))
          : buildDefaultReminders(t);
      const next: RemindersConfig = { reminders: items };
      setSaved(next);
      setDraft(next);
      setHasValidationAttempted(false);
    });
  }, [t]);

  const updateReminder = (index: number, text: string) => {
    setDraft(prev => ({
      ...prev,
      reminders: prev.reminders.map((r, i) => (i === index ? { ...r, text } : r)),
    }));
  };

  const addReminder = () => {
    setDraft(prev => ({
      ...prev,
      reminders: [
        ...prev.reminders,
        { id: allocateReminderId(), text: '' },
      ],
    }));
  };

  const removeReminder = (index: number) => {
    setDraft(prev => ({
      ...prev,
      reminders: prev.reminders.filter((_, i) => i !== index),
    }));
  };

  const dirty
    = JSON.stringify(saved.reminders) !== JSON.stringify(draft.reminders);

  const handleReset = () => {
    setDraft({ reminders: buildDefaultReminders(t) });
    setHasValidationAttempted(false);
  };
  const handleCancel = () => {
    setDraft(saved);
    setHasValidationAttempted(false);
  };

  const handleSave = async () => {
    if (draft.reminders.some(r => isInvalidReminder(r.text))) {
      setHasValidationAttempted(true);
      return;
    }
    setHasValidationAttempted(false);
    await setConfig(
      REMINDERS_KEY,
      encodeReminders(draft.reminders.map(({ text }) => text)),
    );
    setSaved(draft);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {t('reminders:page.title')}
        </Typography>

        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('reminders:page.hint')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {draft.reminders.map((r, i) => (
                <Box key={r.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={4}
                    size="small"
                    value={r.text}
                    placeholder={t('reminders:row.placeholder')}
                    onChange={e => updateReminder(i, e.target.value)}
                    error={hasValidationAttempted && isInvalidReminder(r.text)}
                    sx={{ flex: 1 }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment
                            position="end"
                            sx={{ alignSelf: 'flex-end' }}
                          >
                            <Typography
                              variant="caption"
                              component="span"
                              sx={{
                                fontSize: 10,
                                fontVariantNumeric: 'tabular-nums',
                                minWidth: '3.5em',
                                textAlign: 'right',
                                color: r.text.length > MAX_REMINDER_LENGTH
                                  ? 'error.main'
                                  : 'text.disabled',
                              }}
                            >
                              {r.text.length}
                              /
                              {MAX_REMINDER_LENGTH}
                            </Typography>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  {draft.reminders.length > 1 && (
                    <IconButton size="small" onClick={() => removeReminder(i)}>
                      <CloseOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Button
              size="small"
              startIcon={<AddOutlinedIcon />}
              onClick={addReminder}
              color="inherit"
            >
              {t('reminders:button.add')}
            </Button>
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
          {t('reminders:button.reset')}
        </Button>
        <Button onClick={handleCancel} disabled={!dirty} color="inherit">
          {t('reminders:button.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!dirty} variant="contained">
          {t('reminders:button.save')}
        </Button>
      </Box>
    </Box>
  );
}

export default RemindersPage;
