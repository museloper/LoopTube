"use client";

import { formatTime } from "@/lib/format";

interface FineTunerProps {
  label: string;
  value: number;
  onNudge: (delta: number) => void;
  onSetToPlayhead: () => void;
  disabled?: boolean;
}

const STEPS = [-1, -0.1, 0.1, 1];

/**
 * Landing on the first beat of a phrase by eye is hopeless, so each point can
 * be walked in tenths after it has been dropped roughly in place.
 */
export function FineTuner({ label, value, onNudge, onSetToPlayhead, disabled }: FineTunerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-neutral-900 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-200">{label}</span>
        <span className="font-mono text-sm tabular-nums text-emerald-400">{formatTime(value)}</span>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((step) => (
          <button
            key={step}
            type="button"
            disabled={disabled}
            onClick={() => onNudge(step)}
            className="flex-1 rounded-lg bg-neutral-800 px-2 py-1.5 font-mono text-xs text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
          >
            {step > 0 ? `+${step}` : step}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSetToPlayhead}
        className="rounded-lg bg-neutral-800 px-2 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-40"
      >
        현재 위치로 지정
      </button>
    </div>
  );
}
