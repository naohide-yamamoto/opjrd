import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import type { ExperimentFileLoader } from "../src/core/experiment";
import { loadStimulusAssets } from "../src/trials/stimulus-assets";

const REQUIRED_INPUT_FILES = {
  locationsFile: "locations.csv",
  trialsFile: "trials.csv",
};

function normaliseExperimentConfig(
  raw: Record<string, unknown> = {}
) {
  return normaliseStrictExperimentConfig({
    ...REQUIRED_INPUT_FILES,
    ...raw,
  });
}

class FakeImage {
  static nextOutcome: "error" | "load" = "load";

  private readonly listeners = new Map<
    string,
    EventListenerOrEventListenerObject
  >();

  private source = "";

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    this.listeners.set(type, listener);
  }

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    queueMicrotask(() => {
      this.dispatch(FakeImage.nextOutcome);
    });
  }

  private dispatch(type: string): void {
    const listener = this.listeners.get(type);
    if (!listener) {
      return;
    }

    const event = { type } as Event;
    if (typeof listener === "function") {
      listener.call(this, event);
      return;
    }
    listener.handleEvent(event);
  }
}

function makeFileLoader(): ExperimentFileLoader & {
  loadAssetUrl: ReturnType<typeof vi.fn>;
} {
  return {
    loadAssetUrl: vi.fn(async (path: string) => `asset-url:${path}`),
    loadTextFile: vi.fn(),
  };
}

describe("stimulus image assets", () => {
  afterEach(() => {
    FakeImage.nextOutcome = "load";
    vi.unstubAllGlobals();
  });

  it("does not request image assets when stimulus rendering is text-only", async () => {
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "text",
          images: {
            A: "assets/object-a.svg",
          },
        },
      },
    });
    const fileLoader = makeFileLoader();

    await expect(loadStimulusAssets(config, fileLoader)).resolves.toEqual({
      images: {},
    });
    expect(fileLoader.loadAssetUrl).not.toHaveBeenCalled();
  });

  it("loads configured object image assets through the experiment file loader", async () => {
    vi.stubGlobal("Image", FakeImage);
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "image",
          images: {
            A: "assets/object-a.svg",
            C: "assets/object-c.png",
          },
        },
      },
    });
    const fileLoader = makeFileLoader();

    const assets = await loadStimulusAssets(config, fileLoader);

    expect(fileLoader.loadAssetUrl).toHaveBeenCalledWith("assets/object-a.svg");
    expect(fileLoader.loadAssetUrl).toHaveBeenCalledWith("assets/object-c.png");
    expect(Object.keys(assets.images).sort()).toEqual(["A", "C"]);
    expect((assets.images.A as unknown as FakeImage).src).toBe(
      "asset-url:assets/object-a.svg"
    );
    expect((assets.images.C as unknown as FakeImage).src).toBe(
      "asset-url:assets/object-c.png"
    );
  });

  it("reports the asset URL when an object image cannot be loaded", async () => {
    vi.stubGlobal("Image", FakeImage);
    FakeImage.nextOutcome = "error";
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "image",
          images: {
            A: "assets/missing-object.png",
          },
        },
      },
    });

    await expect(loadStimulusAssets(config, makeFileLoader())).rejects.toThrow(
      /Could not load stimulus image: asset-url:assets\/missing-object\.png/u
    );
  });
});
