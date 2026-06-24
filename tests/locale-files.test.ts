import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LocaleText } from "../src/i18n/locale";

const localePath = (...parts: string[]) =>
  join(process.cwd(), "public", "locales", ...parts);

const expectedLocaleShape: LocaleText = {
  instructions: {
    readyText: "",
    finishTitle: "",
    finishText: "",
    finishButtonLabel: "",
  },
  trial: {
    atLabel: "",
    facingLabel: "",
    placeLabel: "",
    pointToLabel: "",
  },
  status: {
    savedDownload: "",
    savedDownloadWithCsv: "",
    savedTauri: "",
    savedTauriWithCsv: "",
    savedJatos: "",
    saving: "",
    saveCancelled: "",
    saveFailed: "",
  },
  metadata: {
    title: "",
    continueButtonLabel: "",
    fieldRequiredMessage: "",
    selectionRequiredMessage: "",
    freeTextRequiredMessage: "",
    wholeNumberRequiredMessage: "",
  },
  postSave: {
    runSameConfigButtonLabel: "",
    selectDifferentConfigButtonLabel: "",
    backToInitialScreenButtonLabel: "",
    browserConfigPrompt: "",
    browserConfigPathLabel: "",
    browserConfigPathPlaceholder: "",
    loadConfigButtonLabel: "",
    cancelButtonLabel: "",
    noConfigPathMessage: "",
    loadConfigFailed: "",
    noConfigSelected: "",
  },
};

function sortedKeys(value: object): string[] {
  return Object.keys(value).sort();
}

describe("locale files", () => {
  it.each(["en-AU", "ja-JP"])(
    "%s matches the locale contract",
    (locale) => {
      const parsed = JSON.parse(
        readFileSync(localePath(`${locale}.json`), "utf8")
      ) as LocaleText;

      expect(sortedKeys(parsed.instructions)).toEqual(
        sortedKeys(expectedLocaleShape.instructions)
      );
      expect(sortedKeys(parsed.trial)).toEqual(sortedKeys(expectedLocaleShape.trial));
      expect(sortedKeys(parsed.status)).toEqual(
        sortedKeys(expectedLocaleShape.status)
      );
      expect(sortedKeys(parsed.metadata)).toEqual(
        sortedKeys(expectedLocaleShape.metadata)
      );
      expect(sortedKeys(parsed.postSave)).toEqual(
        sortedKeys(expectedLocaleShape.postSave)
      );
    }
  );
});
