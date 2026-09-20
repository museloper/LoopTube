"use client";

interface SpeedPickerProps {
  rates: number[];
  current: number;
  onChange: (rate: number) => void;
  disabled?: boolean;
}

/**
 * The player only accepts the rates it reports, and silently rounds anything
 * else down to the nearest one. A slider would imply 0.6x is reachable, so the
 * supported values are shown as discrete buttons instead.
 */
export function SpeedPicker({ rates, current, onChange, disabled }: SpeedPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">재생 속도</span>
        <span className="text-xs text-neutral-500">음정은 자동 보정됩니다</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rates.map((rate) => {
          const active = Math.abs(rate - current) < 0.001;
          return (
            <button
              key={rate}
              type="button"
              disabled={disabled}
              onClick={() => onChange(rate)}
              className={`min-w-14 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                active
                  ? "bg-emerald-500 text-neutral-950"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {rate}x
            </button>
          );
        })}
      </div>
    </div>
  );
}
