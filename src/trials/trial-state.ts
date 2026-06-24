import type { TimingConfig } from "../core/types";

export type TrialPhase = "a" | "b" | "response";

export interface TrialPhaseState {
  phase: TrialPhase;
  aOnsetMsec: number;
  bOnsetMsec: number;
  cOnsetMsec: number;
}

export interface TrialPhaseScheduler {
  setTimeout(callback: () => void, delayMsec: number): number;
  clearTimeout(timeoutId: number): void;
}

export interface TrialPhaseRuntime {
  getState(): TrialPhaseState;
  start(aOnsetMsec: number): void;
  stop(): void;
}

export function createTrialPhaseRuntime(
  timing: TimingConfig,
  elapsedMsec: () => number,
  scheduler: TrialPhaseScheduler,
  onPhaseChange: (state: TrialPhaseState) => void = () => undefined
): TrialPhaseRuntime {
  let state: TrialPhaseState = {
    phase: "a",
    aOnsetMsec: Number.NaN,
    bOnsetMsec: Number.NaN,
    cOnsetMsec: Number.NaN,
  };
  let started = false;
  const timeoutIds: number[] = [];

  const updateState = (nextState: Partial<TrialPhaseState>) => {
    state = {
      ...state,
      ...nextState,
    };
    onPhaseChange(state);
  };

  return {
    getState: () => state,
    start: (aOnsetMsec: number) => {
      if (started) {
        return;
      }
      started = true;
      updateState({
        phase: "a",
        aOnsetMsec,
      });

      timeoutIds.push(
        scheduler.setTimeout(() => {
          updateState({
            phase: "b",
            aOnsetMsec,
            bOnsetMsec: elapsedMsec(),
          });
        }, timing.aToBDelayMsec),
        scheduler.setTimeout(() => {
          updateState({
            phase: "response",
            aOnsetMsec,
            bOnsetMsec: Number.isFinite(state.bOnsetMsec)
              ? state.bOnsetMsec
              : elapsedMsec(),
            cOnsetMsec: elapsedMsec(),
          });
        }, timing.aToBDelayMsec + timing.bToCDelayMsec)
      );
    },
    stop: () => {
      timeoutIds.forEach((timeoutId) => scheduler.clearTimeout(timeoutId));
      timeoutIds.length = 0;
    },
  };
}
