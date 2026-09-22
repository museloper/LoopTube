"use client";

interface RepCounterProps {
  reps: number;
  restSeconds: number;
  onRestChange: (seconds: number) => void;
  autoStepEvery: number;
  onAutoStepChange: (reps: number) => void;
  disabled?: boolean;
}

const REST_OPTIONS = [0, 0.5, 1, 2, 3];
const AUTO_STEP_OPTIONS = [0, 5, 10, 20];

/**
 * The option rows are button groups, not labelled controls: wrapping them in a
 * <label> would make a tap on the caption activate the first button.
 */
export function RepCounter({
  reps,
  restSeconds,
  onRestChange,
  autoStepEvery,
  onAutoStepChange,
  disabled,
}: RepCounterProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-neutral-900 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">반복</span>
        <span className="font-mono text-2xl tabular-nums text-emerald-400">{reps}</span>
      </div>

      <div role="group" aria-labelledby="rest-label" className="flex flex-col gap-1.5">
        <span id="rest-label" className="text-xs text-neutral-400">반복 사이 쉬는 시간</span>
        <div className="flex gap-1.5">
          {REST_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onRestChange(value)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition disabled:opacity-40 ${
                restSeconds === value
                  ? "bg-emerald-500 text-neutral-950"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {value === 0 ? "없음" : `${value}초`}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="auto-step-label" className="flex flex-col gap-1.5">
        <span id="auto-step-label" className="text-xs text-neutral-400">N회마다 속도 올리기</span>
        <div className="flex gap-1.5">
          {AUTO_STEP_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onAutoStepChange(value)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition disabled:opacity-40 ${
                autoStepEvery === value
                  ? "bg-emerald-500 text-neutral-950"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {value === 0 ? "끄기" : `${value}회`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
