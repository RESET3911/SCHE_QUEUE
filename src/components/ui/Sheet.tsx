import type { ReactNode } from 'react';

// 設定画面などで使うモーダル版ボトムシート
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border-x border-t border-board-line bg-board-panel shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-board-line bg-board-panel px-4 py-3">
          <h2 className="text-sm font-bold tracking-wide">{title}</h2>
          <button onClick={onClose} className="rounded-full px-2.5 py-1 text-sm text-board-dim hover:bg-board-raise">
            ✕
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
