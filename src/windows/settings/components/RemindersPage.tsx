import type { TFunction } from 'i18next';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  decodeRemindersConfig,
  encodeRemindersConfig,
  getConfig,
  REMINDERS_KEY,
  setConfig,
} from '@src/shared/config';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReminderItem {
  id: number;
  text: string;
}

// 两类文案的草稿/已保存结构（带前端运行时 id，id 不参与持久化）。
interface ReminderList {
  health: ReminderItem[];
  whisper: ReminderItem[];
}

type ReminderTab = 'health' | 'whisper';

const MAX_REMINDER_LENGTH = 500;

function isInvalidReminder(text: string): boolean {
  return text.trim() === '' || text.length > MAX_REMINDER_LENGTH;
}

// 健康提醒默认文案（走动/喝水，走 i18n）。
function defaultHealthTexts(t: TFunction): string[] {
  return [t('reminders:defaultMessage.walk'), t('reminders:defaultMessage.water')];
}

// 随笔心语默认文案（文学摘抄，固定中文）。
const DEFAULT_WHISPER_TEXTS: string[] = [
  '成功只有一个 ———— 按照自己的方式，去度过人生。',
  '世界上只有一种真正的英雄主义，那就是在认清生活的真相后依然热爱生活。',
  '这个世界上有很多人，很多种选择，最低的是温饱，然后是利益，就是钱，超越钱的，是名望、权利，但是在超越这些所有东西之上还有一样东西，叫智慧。... 因为我知道我懂的越来越多，只有智慧和知识，内在强大，让你自己懂得很多，对这个世界你有充分的了解，你就不会有畏惧。',
  '在我们的身边，经常会出现一些人，让我们一见如故，感觉温暖，如沐春风，这种气质往往是天生的，我们都愿意和这样的人交往。',
  '因为我要告诉你，所谓千秋霸业，万古流芳，以及一切的一切，只是粪土。先变成粪，再变成土。现在你不明白，将来你会明白，将来不明白，就再等将来，如果一辈子都不明白，也行。',
  '纯粹的人，是这个世界上最可怕的人，他们的一生，往往只有一个目标，为了达到这个目标，他们可以不择手段，不顾一切，他们无法被收买，无法被威逼，他们不要钱 ———— 纯粹和执着，也是有区别的，所谓执着，就是不见棺材不掉泪，而纯粹，是见了棺材，也不掉泪。',
  '长期的困难生活，最能磨炼一个人的意志。有很多人在遇到困难后，只能怨天尤人，得过且过，而另外一些人虽然也不得不在困难面前低头，但他们的心从未屈服，他们不断地努力，相信一定能够取得最后的胜利。',
  '当你感到畏惧和痛苦，支撑不下去的时候，你应该同时意识到，决定你命运的时候到了。 因为畏惧并不是消极的，事实上，它是一个人真正强大的开始，也是成为英雄的起点。 不懂得畏惧的人不知道什么是困难，也无法战胜困难。 只有懂得畏惧的人，才能唤起自己的力量。 只有懂得畏惧的人，才有勇气去战胜畏惧。 懂得畏惧的可怕，还能超越它、征服它的人，就是英雄。',
  '所谓道，是天下所有规律的总和，是最根本的法则，只要能够了解道，就可以明了世间所有的一切。',
  '无论何时、何地，有何种理由，人性都是不能，也不会被泯灭的，它将永远屹立于天地之间。',
  '滚滚长江东逝水，浪花淘尽英雄。是非成败转头空，青山依旧在，几度夕阳红。 白发渔樵江渚上，惯看秋月春风。一壶浊酒喜相逢，古今多少事，都付笑谈中。',
  '无论有多么伟大正直的理想，要实现它，还必须懂得两个字——变通。只有变通，只有切合实际的行动，才能适应这个变化万千的世界。',
  '常人，有正常的欲望，有自己的小算盘，有过犹豫和挣扎，有过贪婪和污点，你才能明白，那个不顾一切、顶住压力坚持改革的张居正，到底有多么的伟大。',
  '你还很年轻，将来你会遇到很多人，经历很多事，得到很多，也会失去很多，但无论如何，有两样东西，你绝不能丢弃，一个叫良心，另一个叫理想。',
];

function RemindersPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReminderTab>('health');
  const [hasValidationAttempted, setHasValidationAttempted] = useState(false);
  const reminderIdRef = useRef(0);

  // 自增 id 生成器：保证两类列表合并后所有 id 全局唯一，避免增删时输入框错位。
  // 仅依赖 ref（稳定），故空依赖；stable 引用可安全用于 useEffect 依赖数组。
  const allocateReminderId = useCallback(() => {
    reminderIdRef.current += 1;
    return reminderIdRef.current;
  }, []);

  // 把纯文案数组包装成带 id 的条目（持久化只存 text，id 仅作 React key）。
  const buildItems = useCallback(
    (texts: string[]): ReminderItem[] =>
      texts.map(text => ({ id: allocateReminderId(), text })),
    [allocateReminderId],
  );

  const [saved, setSaved] = useState<ReminderList>(() => ({
    health: buildItems(defaultHealthTexts(t)),
    whisper: buildItems(DEFAULT_WHISPER_TEXTS),
  }));
  const [draft, setDraft] = useState<ReminderList>(saved);

  useEffect(() => {
    getConfig(REMINDERS_KEY).then((raw) => {
      const decoded = decodeRemindersConfig(raw);
      const health = decoded.health.length > 0
        ? buildItems(decoded.health)
        : buildItems(defaultHealthTexts(t));
      const whisper = decoded.whisper.length > 0
        ? buildItems(decoded.whisper)
        : buildItems(DEFAULT_WHISPER_TEXTS);
      const next: ReminderList = { health, whisper };
      setSaved(next);
      setDraft(next);
      setHasValidationAttempted(false);
    });
  }, [t, buildItems]);

  // —— CRUD 仅作用于当前激活 Tab 的列表 ——
  const updateReminder = (index: number, text: string) => {
    setDraft(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map((r, i) => (i === index ? { ...r, text } : r)),
    }));
  };

  const addReminder = () => {
    setDraft(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], { id: allocateReminderId(), text: '' }],
    }));
  };

  const removeReminder = (index: number) => {
    setDraft(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter((_, i) => i !== index),
    }));
  };

  // dirty 按当前 Tab 判断：底部按钮「共用但分别处理」。
  const dirty
    = JSON.stringify(saved[activeTab]) !== JSON.stringify(draft[activeTab]);

  const handleReset = () => {
    const texts = activeTab === 'health' ? defaultHealthTexts(t) : DEFAULT_WHISPER_TEXTS;
    setDraft(prev => ({ ...prev, [activeTab]: buildItems(texts) }));
    setHasValidationAttempted(false);
  };
  const handleCancel = () => {
    setDraft(prev => ({ ...prev, [activeTab]: saved[activeTab] }));
    setHasValidationAttempted(false);
  };

  const handleSave = async () => {
    if (draft[activeTab].some(r => isInvalidReminder(r.text))) {
      setHasValidationAttempted(true);
      return;
    }
    setHasValidationAttempted(false);
    // 单 key 结构化对象：当前 Tab 用 draft，另一类保留其 saved 值（互不污染）。
    const merged = {
      health: (activeTab === 'health' ? draft.health : saved.health).map(({ text }) => text),
      whisper: (activeTab === 'whisper' ? draft.whisper : saved.whisper).map(({ text }) => text),
    };
    await setConfig(REMINDERS_KEY, encodeRemindersConfig(merged));
    setSaved(prev => ({ ...prev, [activeTab]: draft[activeTab] }));
  };

  const items = draft[activeTab];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {t('reminders:page.title')}
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_, value: ReminderTab) => {
            setActiveTab(value);
            setHasValidationAttempted(false);
          }}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab value="health" label={t('reminders:tab.health')} />
          <Tab value="whisper" label={t('reminders:tab.whisper')} />
        </Tabs>

        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t('reminders:page.hint')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
              {items.map((r, i) => (
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
                  {items.length > 1 && (
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
