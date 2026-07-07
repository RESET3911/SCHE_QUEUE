// ST APPS 共通: 左上に固定表示する HUB へ戻るボタン
export default function HubButton() {
  return (
    <a
      href="https://RESET3911.github.io/"
      aria-label="HUBへ戻る"
      className="fixed left-2 top-2 z-[45] flex items-center gap-1.5 rounded-full border border-board-line bg-board-panel/90 px-2.5 py-1.5 text-[11px] font-bold tracking-widest text-board-dim backdrop-blur-sm transition-transform active:scale-95"
    >
      <span className="text-sm leading-none">🏠</span>
      <span>HUB</span>
    </a>
  );
}
