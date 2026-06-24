export interface TrialFullscreenAdapter {
  enterTrialFullscreen: () => Promise<void>;
  exitTrialFullscreen: () => Promise<void> | void;
}

function getFullscreenDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

export const browserTrialFullscreenAdapter: TrialFullscreenAdapter = {
  async enterTrialFullscreen(): Promise<void> {
    const fullscreenDocument = getFullscreenDocument();

    if (
      !fullscreenDocument ||
      fullscreenDocument.fullscreenElement ||
      !fullscreenDocument.documentElement.requestFullscreen
    ) {
      return;
    }

    await fullscreenDocument.documentElement
      .requestFullscreen()
      .catch(() => undefined);
  },

  exitTrialFullscreen(): void {
    const fullscreenDocument = getFullscreenDocument();

    if (
      !fullscreenDocument ||
      !fullscreenDocument.fullscreenElement ||
      !fullscreenDocument.exitFullscreen
    ) {
      return;
    }

    void fullscreenDocument.exitFullscreen().catch(() => undefined);
  },
};

let trialFullscreenAdapter: TrialFullscreenAdapter =
  browserTrialFullscreenAdapter;

export function setTrialFullscreenAdapter(
  adapter: TrialFullscreenAdapter
): () => void {
  const previousAdapter = trialFullscreenAdapter;
  trialFullscreenAdapter = adapter;

  return () => {
    trialFullscreenAdapter = previousAdapter;
  };
}

export function resetTrialFullscreenAdapter(): void {
  trialFullscreenAdapter = browserTrialFullscreenAdapter;
}

export async function enterTrialFullscreen(): Promise<void> {
  await trialFullscreenAdapter.enterTrialFullscreen();
}

export function exitTrialFullscreen(): void {
  void trialFullscreenAdapter.exitTrialFullscreen();
}
