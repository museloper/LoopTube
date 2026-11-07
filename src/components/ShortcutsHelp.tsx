"use client";

import { useEffect } from "react";

/** Each entry is one alternative; a combo is the keys pressed together. */
type Keys = string[][];

/**
 * One action per row: pairing "뒤로 / 앞으로" in a row made it unclear which
 * key did which, and the "/" between keys read the same as the one in the text.
 */
const shortcutGroups = (mod: string): { title: string; rows: { action: string; keys: Keys }[] }[] => [
  {
    title: "재생",
    rows: [
      { action: "재생 / 일시정지", keys: [["Space"], ["P"]] },
      { action: "구간 시작 지점부터 재생", keys: [[mod, "←"]] },
    ],
  },
  {
    title: "구간",
    rows: [
      { action: "현재 위치를 구간 시작으로", keys: [["["]] },
      { action: "현재 위치를 구간 끝으로", keys: [["]"]] },
      { action: "구간 반복 켜기 / 끄기", keys: [["L"]] },
    ],
  },
  {
    title: "이동",
    rows: [
      { action: "1초 뒤로", keys: [["←"], [","]] },
      { action: "1초 앞으로", keys: [["→"], ["."]] },
      { action: "5초 뒤로", keys: [["Shift", "←"], ["Shift", ","]] },
      { action: "5초 앞으로", keys: [["Shift", "→"], ["Shift", "."]] },
    ],
  },
  {
    title: "속도",
    rows: [
      { action: "한 단계 느리게", keys: [["-"]] },
      { action: "한 단계 빠르게", keys: [["="]] },
    ],
  },
];

/** The footer pairs opposite directions and shows only the main keys; the popup has the rest. */
const footerItems = (mod: string): { label: string; keys: Keys }[] => [
  { label: "재생 / 일시정지", keys: [["Space"]] },
  { label: "구간 시작부터 재생", keys: [[mod, "←"]] },
  { label: "구간 시작 · 끝", keys: [["["], ["]"]] },
  { label: "구간 반복", keys: [["L"]] },
  { label: "1초 이동", keys: [["←"], ["→"]] },
  { label: "5초 이동", keys: [["Shift", "←"], ["Shift", "→"]] },
  { label: "속도 조절", keys: [["-"], ["="]] },
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

        <div className="flex flex-col gap-4">
          {shortcutGroups(playFromStartKey).map(({ title, rows }) => (
            <section key={title}>
              <h3 className="mb-1 text-xs font-semibold text-emerald-400">{title}</h3>
              <ul className="divide-y divide-neutral-800 text-sm">
                {rows.map(({ action, keys }) => (
                  <li key={action} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="break-keep text-neutral-300">{action}</span>
                    <KeyAlternatives keys={keys} separator="또는" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

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

function KeyCombo({ combo }: { combo: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {combo.map((key, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="text-neutral-500">+</span>}
          <kbd className="min-w-6 rounded border-b-2 border-neutral-950 bg-neutral-800 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-100">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

/** Alternatives wrap as whole combos, so a long list can't squeeze the text beside it. */
function KeyAlternatives({
  keys,
  separator,
  className = "shrink-0",
}: {
  keys: Keys;
  separator?: string;
  className?: string;
}) {
  return (
    <span className={`flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 ${className}`}>
      {keys.map((combo, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && separator && <span className="text-xs text-neutral-500">{separator}</span>}
          <KeyCombo combo={combo} />
        </span>
      ))}
    </span>
  );
}

/** Compact always-visible list under the controls; "단축키 안내" opens the full one. */
export function ShortcutsFooter({ playFromStartKey }: { playFromStartKey: string }) {
  return (
    <ul className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
      {footerItems(playFromStartKey).map(({ label, keys }) => (
        <li
          key={label}
          className="flex items-center justify-between gap-3 rounded-lg bg-neutral-900 px-3 py-2"
        >
          {/* The label never breaks; when a card is tight the keys wrap instead. */}
          <span className="shrink-0 whitespace-nowrap text-neutral-400">{label}</span>
          <KeyAlternatives keys={keys} className="min-w-0" />
        </li>
      ))}
    </ul>
  );
}
