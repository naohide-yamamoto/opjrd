import { describe, expect, it } from "vitest";
import type { LocaleText } from "../src/i18n/locale";
import { saveFailureRecovery } from "../src/data/save-flow";
import { TauriSaveCancelledError } from "../src/data/tauri-save-adapter";

const localeText = {
  status: {
    saveCancelled: "Save cancelled. Click Save to choose an output folder.",
    saveFailed: "Data save failed.",
  },
} as LocaleText;

describe("save retry flow", () => {
  it("keeps cancelled Tauri saves recoverable without logging an error", () => {
    expect(
      saveFailureRecovery(new TauriSaveCancelledError(), localeText)
    ).toEqual({
      shouldLogError: false,
      statusMessage: "Save cancelled. Click Save to choose an output folder.",
    });
  });

  it("keeps unexpected save failures recoverable while marking them for logging", () => {
    expect(saveFailureRecovery(new Error("disk full"), localeText)).toEqual({
      shouldLogError: true,
      statusMessage: "Data save failed.",
    });
  });
});
