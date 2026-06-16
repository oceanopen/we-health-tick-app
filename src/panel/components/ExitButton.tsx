import { Button, Divider } from '@mui/material';

interface ExitButtonProps {
  onExit: () => void;
}

export function ExitButton({ onExit }: ExitButtonProps) {
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
        退出
      </Button>
    </>
  );
}
