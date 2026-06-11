import { Button, Divider } from '@mui/material';

interface ExitButtonProps {
  onExit: () => void;
}

export function ExitButton({ onExit }: ExitButtonProps) {
  return (
    <>
      <Divider sx={{ width: '100%', borderColor: 'rgba(255,255,255,0.1)' }} />
      <Button
        onClick={onExit}
        fullWidth
        size="small"
        sx={{
          'color': 'rgba(255,255,255,0.6)',
          'textTransform': 'none',
          'fontSize': 13,
          '&:hover': { color: 'rgba(255,255,255,0.9)' },
        }}
      >
        退出
      </Button>
    </>
  );
}
