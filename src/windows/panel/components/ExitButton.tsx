import { Button, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ExitButtonProps {
  onExit: () => void;
}

export function ExitButton({ onExit }: ExitButtonProps) {
  const { t } = useTranslation();

  return (
    <>
      <Divider sx={{ width: '100%' }} />
      <Button
        onClick={onExit}
        fullWidth
        size="small"
        color="secondary"
        sx={{
          textTransform: 'none',
          fontSize: 13,
        }}
      >
        {t('panel:exit')}
      </Button>
    </>
  );
}
