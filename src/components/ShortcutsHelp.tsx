"use client";

import { useEffect } from "react";

interface Shortcut {
  keys: string[][];
  action: string;
  /** How many leading combos the compact page footer shows; the popup lists all. */
  footerKeys?: number;
  footerAction?: string;
}

const shortcuts = (playFromStartKey: string): Shortcut[] => [
  { keys: [["Space"], ["P"]], action: "재생 / 일시정지", footerKeys: 1, footerAction: "재생" },
  { keys: [["["]], action: "현재 위치를 구간 시작으로", footerAction: "구간 시작" },
  { keys: [["]"]], action: "현재 위치를 구간 끝으로", footerAction: "구간 끝" },
  { keys: [[playFromStartKey, "←"]], action: "구간 시작 지점부터 재생", footerAction: "시작부터 재생" },
  { keys: [["L"]], action: "구간 반복 켜기 / 끄기", footerAction: "반복 켜기/끄기" },
  { keys: [["←"], ["→"], [","], ["."]], action: "1초 뒤로 / 앞으로", footerKeys: 2, footerAction: "1초 이동" },
  {
    keys: [["Shift", "←"], ["Shift", "→"], ["Shift", ","], ["Shift", "."]],
    action: "5초 뒤로 / 앞으로",
    footerKeys: 2,
    footerAction: "5초 이동",
  },
  { keys: [["-"], ["="]], action: "속도 한 단계 낮추기 / 높이기", footerAction: "속도 조절" },
];

interface ShortcutsHelpProps {
  open: boolean;
  /** "Cmd" on macOS, "Ctrl" elsewhere. */
  playFromStartKey: string;
  onClose: () => void;
  /** Absent when opened on demand, since snoozing only makes sense for the automatic popup. */
  onSnooze?: () => void;
}

export function ShortcutsHelp({ open, playFromStartKey, onClose, onSnooze }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-xl bg-neutral-900 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="shortcuts-title" className="text-base font-bold text-neutral-100">
          단축키 안내
        </h2>

        <table className="w-full text-sm">
          <tbody>
            {shortcuts(playFromStartKey).map(({ keys, action }) => (
              <tr key={action} className="border-b border-neutral-800 last:border-0">
                <td className="w-1/2 py-2 pr-4 align-top">
                  <ShortcutKeys keys={keys} />
                </td>
                <td className="break-keep py-2 align-top leading-6 text-neutral-300">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end gap-2">
          {onSnooze && (
            <button
              type="button"
              onClick={onSnooze}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-700"
            >
              일주일 동안 보지 않기
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/** Combos wrap as whole units, so a long list can't squeeze the text beside it. */
function ShortcutKeys({ keys }: { keys: string[][] }) {
  return keys.map((combo, i) => (
    <span key={i} className="inline-block whitespace-nowrap leading-6">
      {i > 0 && <span className="px-1 text-neutral-600">/</span>}
      {combo.map((key, j) => (
        <span key={j}>
          {j > 0 && <span className="px-0.5 text-neutral-500">+</span>}
          <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-200">{key}</kbd>
        </span>
      ))}
    </span>
  ));
}

/** Compact always-visible list under the controls; "단축키 안내" opens the full one. */
export function ShortcutsFooter({ playFromStartKey }: { playFromStartKey: string }) {
  return (
    <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
      {shortcuts(playFromStartKey).map(({ keys, action, footerKeys, footerAction }) => (
        <li
          key={action}
          className="flex items-center justify-between gap-3 rounded-lg bg-neutral-900 px-3 py-2"
        >
          <span className="break-keep text-neutral-400">{footerAction ?? action}</span>
          <span className="text-right">
            <ShortcutKeys keys={keys.slice(0, footerKeys ?? keys.length)} />
          </span>
        </li>
      ))}
    </ul>
  );
}
