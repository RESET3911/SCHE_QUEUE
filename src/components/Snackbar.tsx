import { useEffect } from 'react';

export interface SnackState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  snack: SnackState;
  onDismiss: () => void;
  durationMs?: number;
}

export default function Snackbar({ snack, onDismiss, durationMs = 6000 }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [snack, onDismiss, durationMs]);

  return (
    <div className="animate-snack-in fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center justify-between rounded-lg border border-board-line bg-board-raise px-4 py-3 shadow-xl shadow-black/60">
      <span className="text-sm">{snack.message}</span>
      {snack.actionLabel && snack.onAction && (
        <button
          onClick={snack.onAction}
          className="ml-3 shrink-0 font-mono text-sm font-bold text-board-amber"
        >
          {snack.actionLabel}
        </button>
      )}
    </div>
  );
}
