export interface LocaleText {
  instructions: {
    readyText: string;
    finishTitle: string;
    finishText: string;
    finishButtonLabel: string;
  };
  trial: {
    atLabel: string;
    facingLabel: string;
    placeLabel: string;
    pointToLabel: string;
  };
  status: {
    savedDownload: string;
    savedDownloadWithCsv: string;
    savedTauri: string;
    savedTauriWithCsv: string;
    savedJatos: string;
    saving: string;
    saveCancelled: string;
    saveFailed: string;
  };
  metadata: {
    title: string;
    continueButtonLabel: string;
    fieldRequiredMessage: string;
    selectionRequiredMessage: string;
    freeTextRequiredMessage: string;
    wholeNumberRequiredMessage: string;
  };
  postSave: {
    runSameConfigButtonLabel: string;
    selectDifferentConfigButtonLabel: string;
    backToInitialScreenButtonLabel: string;
    browserConfigPrompt: string;
    browserConfigPathLabel: string;
    browserConfigPathPlaceholder: string;
    loadConfigButtonLabel: string;
    cancelButtonLabel: string;
    noConfigPathMessage: string;
    loadConfigFailed: string;
    noConfigSelected: string;
  };
}

export async function loadLocale(locale: string): Promise<LocaleText> {
  const response = await fetch(`locales/${locale}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load locale: ${locale} (${response.status}).`);
  }

  return response.json() as Promise<LocaleText>;
}
