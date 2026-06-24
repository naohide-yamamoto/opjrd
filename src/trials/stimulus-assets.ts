import type { ExperimentFileLoader } from "../core/experiment";
import type { ExperimentConfig } from "../core/types";

export interface LoadedStimulusAssets {
  images: Record<string, HTMLImageElement>;
}

export const EMPTY_STIMULUS_ASSETS: LoadedStimulusAssets = {
  images: {},
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error(`Could not load stimulus image: ${url}`)),
      { once: true }
    );
    image.src = url;
  });
}

export async function loadStimulusAssets(
  config: ExperimentConfig,
  fileLoader: ExperimentFileLoader
): Promise<LoadedStimulusAssets> {
  if (config.response.stimuli.mode !== "image") {
    return EMPTY_STIMULUS_ASSETS;
  }

  const images = Object.fromEntries(
    await Promise.all(
      Object.entries(config.response.stimuli.images).map(async ([name, path]) => {
        const url = await fileLoader.loadAssetUrl(path);
        return [name, await loadImage(url)] as const;
      })
    )
  );

  return { images };
}
