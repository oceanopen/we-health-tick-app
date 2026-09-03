import type { QuietHourPeriod } from '@src/shared/appConfig';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

// 时段行条目：QuietHourPeriod + React key。id 仅作列表渲染 key，
// 保存前由调用方剥离，不落库；分配器（allocateId）归 PlanPage 单调持有，
// 保证「DB 加载」与「新增行」两个分配点共用同一计数器、key 永不冲突。
export interface PeriodItem extends QuietHourPeriod {
  id: number;
}

interface PeriodListEditorProps {
  /** 受控时段列表（quiet_hours / dnd_hours 同构共用）。 */
  periods: PeriodItem[];
  /** 空态文案 i18n key（如 plan:quietHours.empty）。 */
  emptyKey: string;
  /** 添加按钮文案 i18n key（如 plan:dndHours.add）。 */
  addKey: string;
  /** 新行 id 分配器（PlanPage 单调计数器注入，见 PeriodItem 注释）。 */
  allocateId: () => number;
  /** 开关关闭时置灰禁用（不隐藏——保留「已配置了什么」的视觉上下文）。 */
  disabled?: boolean;
  onChange: (next: PeriodItem[]) => void;
}

const TIME_INPUT_SX = { width: 120 } as const;

// 时段列表受控编辑器：行 = start/end 两个 time 输入 + 删除按钮，底部添加按钮（默认 12:00-13:00）。
// 纯受控组件，无内部状态；从 PlanPage 的 quietHours 内联编辑抽取，双列表共用。
export function PeriodListEditor({
  periods,
  emptyKey,
  addKey,
  allocateId,
  disabled = false,
  onChange,
}: PeriodListEditorProps) {
  const { t } = useTranslation();

  const updateField = (index: number, field: keyof QuietHourPeriod, value: string) => {
    onChange(periods.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const addPeriod = () => {
    onChange([...periods, { id: allocateId(), start: '12:00', end: '13:00' }]);
  };

  const removePeriod = (index: number) => {
    onChange(periods.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {periods.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
          {t(emptyKey)}
        </Typography>
      )}
      {periods.map((p, i) => (
        <Box key={p.id} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <TextField
            type="time"
            size="small"
            value={p.start}
            onChange={e => updateField(i, 'start', e.target.value)}
            sx={TIME_INPUT_SX}
            disabled={disabled}
          />
          <Typography color="text.secondary">—</Typography>
          <TextField
            type="time"
            size="small"
            value={p.end}
            onChange={e => updateField(i, 'end', e.target.value)}
            sx={TIME_INPUT_SX}
            disabled={disabled}
          />
          <IconButton size="small" onClick={() => removePeriod(i)} disabled={disabled}>
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddOutlinedIcon />}
        onClick={addPeriod}
        color="inherit"
        disabled={disabled}
      >
        {t(addKey)}
      </Button>
      {/* 区间语义说明（两列表共用同一文案）：12:00 即 12:00:00 起生效、[start, end) 左闭右开。 */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', fontSize: 11 }}
      >
        {t('plan:periodRangeHint')}
      </Typography>
    </Box>
  );
}
