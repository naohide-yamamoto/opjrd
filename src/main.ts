import { initJsPsych } from "jspsych";
import HtmlButtonResponsePlugin from "@jspsych/plugin-html-button-response";
import HtmlKeyboardResponsePlugin from "@jspsych/plugin-html-keyboard-response";
import "jspsych/css/jspsych.css";
import "./styles.css";
import type {
  ParticipantMetadataFieldConfig,
  ParticipantMetadataValue,
} from "./core/types";
import { calculateConfigHash } from "./core/config-hash";
import { loadExperimentModel } from "./core/experiment";
import {
  renderConfigEditor,
  type ConfigEditorOptions,
} from "./config-editor/config-editor-ui";
import { createDefaultEditorConfig } from "./config-editor/config-editor-model";
import { buildSessionEnvelope } from "./data/session";
import type { ParticipantMetadataBlock } from "./data/session";
import {
  collectParticipantMetadata,
  interactiveParticipantMetadataFields,
} from "./data/participant-metadata";
import { canonicaliseTrialRows } from "./data/output-rows";
import {
  buildSaveBundle,
  selectSaveAdapter,
  type SaveAdapter,
  type SaveBundle,
} from "./data/save-adapters";
import { saveFailureRecovery } from "./data/save-flow";
import {
  joinConfigSavePath,
  saveConfigText,
} from "./data/config-file-save";
import {
  chooseTauriConfigFolderPath,
  chooseTauriStimulusImage,
  chooseTauriStimulusImageInFolder,
  chooseTauriConfigPath,
  loadBrowserExperimentSource,
  loadTauriExperimentSource,
  loadTauriExperimentSourceForEditing,
  localConfigFolderEditorLabel,
  localConfigFolderDisplayPath,
  shouldUseTauriLocalConfig,
  validateTauriExperimentDataFilePath,
  validateTauriExperimentDataFilePathInFolder,
  validateTauriStimulusImagePath,
  validateTauriStimulusImagePathInFolder,
  type ExperimentSource,
} from "./data/experiment-source";
import { loadLocale, type LocaleText } from "./i18n/locale";
import { buildModeTimeline } from "./modes/mode-loader";
import { loadStimulusAssets } from "./trials/stimulus-assets";
import {
  cleanupTrialRunPresentation,
  exitTrialFullscreen,
  prepareTrialRunPresentation,
} from "./trials/trial-rendering";
import { installTauriFullscreenAdapter } from "./runtime/tauri-fullscreen";

const DEFAULT_CONFIG_PATH = "assets/examples/basic/config.json";
const APP_LOGO_URL = new URL("../src-tauri/icons/opjrd-icon.svg", import.meta.url)
  .href;

function getConfigUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const configPath = params.get("config") ?? DEFAULT_CONFIG_PATH;
  return new URL(configPath, window.location.href).toString();
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message: string): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app) {
    app.innerHTML = `<main class="opjrd-status"><p>${escapeHtml(message)}</p></main>`;
  }
}

function clearApp(): void {
  document.querySelector<HTMLDivElement>("#app")?.replaceChildren();
}

function disableContextMenu(element: Element): void {
  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

function setButtonsDisabled(buttons: HTMLButtonElement[], disabled: boolean): void {
  for (const button of buttons) {
    button.disabled = disabled;
  }
}

function createActionButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

function renderTauriConfigChooser(): {
  editButton: HTMLButtonElement;
  newButton: HTMLButtonElement;
  runButton: HTMLButtonElement;
  status: HTMLParagraphElement;
} {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.innerHTML = `
    <main class="opjrd-start opjrd-config-picker">
      <img
        class="opjrd-app-logo"
        src="${APP_LOGO_URL}"
        alt="OPJRD app icon"
        width="112"
        height="112"
      >
      <h1>OPJRD</h1>
      <p>Choose an experiment config to begin.</p>
      <div class="opjrd-config-picker-actions">
        <button type="button" data-opjrd-config-run>Run experiment</button>
        <button type="button" data-opjrd-config-edit>Edit config</button>
        <button type="button" data-opjrd-config-new>New config</button>
      </div>
      <p class="opjrd-config-picker-status" aria-live="polite"></p>
    </main>
  `;

  const runButton = app.querySelector<HTMLButtonElement>(
    "[data-opjrd-config-run]"
  );
  const editButton = app.querySelector<HTMLButtonElement>(
    "[data-opjrd-config-edit]"
  );
  const newButton = app.querySelector<HTMLButtonElement>(
    "[data-opjrd-config-new]"
  );
  const status = app.querySelector<HTMLParagraphElement>(
    ".opjrd-config-picker-status"
  );
  const picker = app.querySelector<HTMLElement>(".opjrd-config-picker");
  if (!runButton || !editButton || !newButton || !status || !picker) {
    throw new Error("OPJRD config chooser could not be created.");
  }
  disableContextMenu(picker);

  return { editButton, newButton, runButton, status };
}

function setConfigChooserButtonsDisabled(
  buttons: HTMLButtonElement[],
  disabled: boolean
): void {
  setButtonsDisabled(buttons, disabled);
}

async function chooseExistingConfigForEditing(): Promise<ExperimentSource | null> {
  const selectedPath = await chooseTauriConfigPath();
  return selectedPath ? loadTauriExperimentSourceForEditing(selectedPath) : null;
}

function renderTauriConfigEditorLauncher(
  source: ExperimentSource,
  onBack: (message?: string) => void
): void {
  const localConfigPath = source.localConfigPath;
  const localConfigFolderPath = source.localConfigFolderPath;
  let chooseStimulusImage: ConfigEditorOptions["chooseStimulusImage"];
  let validateExperimentDataFilePath: ConfigEditorOptions["validateExperimentDataFilePath"];
  let validateStimulusImagePath: ConfigEditorOptions["validateStimulusImagePath"];

  if (localConfigPath) {
    chooseStimulusImage = () => chooseTauriStimulusImage(localConfigPath);
    validateExperimentDataFilePath = (relativePath) =>
      validateTauriExperimentDataFilePath(localConfigPath, relativePath);
    validateStimulusImagePath = (relativePath) =>
      validateTauriStimulusImagePath(localConfigPath, relativePath);
  } else if (localConfigFolderPath) {
    chooseStimulusImage = () =>
      chooseTauriStimulusImageInFolder(localConfigFolderPath);
    validateExperimentDataFilePath = (relativePath) =>
      validateTauriExperimentDataFilePathInFolder(
        localConfigFolderPath,
        relativePath
      );
    validateStimulusImagePath = (relativePath) =>
      validateTauriStimulusImagePathInFolder(
        localConfigFolderPath,
        relativePath
      );
  }

  renderConfigEditor({
    initialConfig: source.config,
    sourceLabel: source.sourceLabel ?? source.configPath,
    onBack: () => {
      onBack();
    },
    onSaved: () => {
      onBack("Config saved.");
    },
    onSave: (configText) => {
      const defaultSavePath = localConfigFolderPath
        ? joinConfigSavePath(localConfigFolderPath)
        : localConfigPath ?? "config.json";
      return saveConfigText(configText, defaultSavePath);
    },
    chooseStimulusImage,
    validateExperimentDataFilePath,
    validateStimulusImagePath,
  });
}

async function chooseExperimentFolderForNewConfig(): Promise<ExperimentSource | null> {
  const folderPath = await chooseTauriConfigFolderPath();
  if (!folderPath) {
    return null;
  }

  return {
    config: createDefaultEditorConfig(),
    configPath: localConfigFolderDisplayPath(folderPath),
    fileLoader: {
      loadAssetUrl: async () => {
        throw new Error("New config has not been saved yet.");
      },
      loadTextFile: async () => {
        throw new Error("New config has not been saved yet.");
      },
    },
    localConfigFolderPath: folderPath,
    sourceLabel: localConfigFolderEditorLabel(folderPath),
  };
}

async function requestTauriExperimentSource(
  initialStatus = ""
): Promise<ExperimentSource> {
  const { editButton, newButton, runButton, status } = renderTauriConfigChooser();
  status.textContent = initialStatus;
  const buttons = [editButton, newButton, runButton];

  return new Promise((resolve) => {
    const renderLauncherAgain = (message = ""): void => {
      void requestTauriExperimentSource(message).then(resolve);
    };

    runButton.addEventListener("click", () => {
      void (async () => {
        setConfigChooserButtonsDisabled(buttons, true);
        status.textContent = "Opening config chooser...";
        try {
          const selectedPath = await chooseTauriConfigPath();
          if (selectedPath) {
            status.textContent = "Loading experiment config...";
            resolve(await loadTauriExperimentSource(selectedPath));
            return;
          }
          status.textContent = "No config selected.";
        } catch (error) {
          console.error(error);
          status.textContent = errorMessage(error, "Could not load config.");
        }
        setConfigChooserButtonsDisabled(buttons, false);
      })();
    });

    editButton.addEventListener("click", () => {
      void (async () => {
        setConfigChooserButtonsDisabled(buttons, true);
        status.textContent = "Opening config chooser...";
        try {
          const source = await chooseExistingConfigForEditing();
          if (source) {
            renderTauriConfigEditorLauncher(source, renderLauncherAgain);
            return;
          }
          status.textContent = "No config selected.";
        } catch (error) {
          console.error(error);
          status.textContent = errorMessage(
            error,
            "Could not open config for editing."
          );
        }
        setConfigChooserButtonsDisabled(buttons, false);
      })();
    });

    newButton.addEventListener("click", () => {
      void (async () => {
        setConfigChooserButtonsDisabled(buttons, true);
        status.textContent = "Opening experiment folder chooser...";
        try {
          const source = await chooseExperimentFolderForNewConfig();
          if (source) {
            renderTauriConfigEditorLauncher(source, renderLauncherAgain);
            return;
          }
          status.textContent = "No experiment config folder selected.";
        } catch (error) {
          console.error(error);
          status.textContent = "Could not create a new config.";
        }
        setConfigChooserButtonsDisabled(buttons, false);
      })();
    });
  });
}

async function loadExperimentSource(): Promise<ExperimentSource> {
  const configUrl = getConfigUrl();
  if (shouldUseTauriLocalConfig(window.location.search)) {
    return requestTauriExperimentSource();
  }
  return loadBrowserExperimentSource(configUrl);
}

function savedStatusMessage(
  saveAdapterName: string,
  csvEnabled: boolean,
  localeText: LocaleText
): string {
  if (saveAdapterName === "jatos") {
    return localeText.status.savedJatos;
  }
  if (saveAdapterName === "tauri") {
    return csvEnabled
      ? localeText.status.savedTauriWithCsv
      : localeText.status.savedTauri;
  }
  return csvEnabled
    ? localeText.status.savedDownloadWithCsv
    : localeText.status.savedDownload;
}

async function reloadExperimentSource(
  source: ExperimentSource
): Promise<ExperimentSource> {
  if (source.localConfigPath) {
    return loadTauriExperimentSource(source.localConfigPath);
  }

  return loadBrowserExperimentSource(source.configPath);
}

function setBrowserConfigQuery(configPath: string): void {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("config", configPath);
  window.history.pushState({}, "", nextUrl);
}

function requestBrowserExperimentSource(
  localeText: LocaleText
): Promise<ExperimentSource | null> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.replaceChildren();

  const container = document.createElement("main");
  container.className =
    "opjrd-start opjrd-config-picker opjrd-browser-config-picker";
  disableContextMenu(container);

  const title = document.createElement("h1");
  title.textContent = "OPJRD";

  const prompt = document.createElement("p");
  prompt.textContent = localeText.postSave.browserConfigPrompt;

  const form = document.createElement("form");
  form.className = "opjrd-browser-config-form";

  const label = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = localeText.postSave.browserConfigPathLabel;
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = localeText.postSave.browserConfigPathPlaceholder;
  input.autocomplete = "off";
  label.append(labelText, input);

  const actions = document.createElement("div");
  actions.className = "opjrd-config-picker-actions";
  const loadButton = createActionButton(
    localeText.postSave.loadConfigButtonLabel
  );
  loadButton.type = "submit";
  const cancelButton = createActionButton(localeText.postSave.cancelButtonLabel);
  actions.append(loadButton, cancelButton);

  const status = document.createElement("p");
  status.className = "opjrd-config-picker-status";
  status.setAttribute("aria-live", "polite");

  form.append(label, actions);
  container.append(title, prompt, form, status);
  app.append(container);
  input.focus();

  return new Promise((resolve) => {
    const buttons = [loadButton, cancelButton];

    cancelButton.addEventListener("click", () => {
      resolve(null);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void (async () => {
        const configPath = input.value.trim();
        if (!configPath) {
          status.textContent = localeText.postSave.noConfigPathMessage;
          input.focus();
          return;
        }

        setButtonsDisabled(buttons, true);
        status.textContent = "Loading config...";
        try {
          const configUrl = new URL(configPath, window.location.href).toString();
          const source = await loadBrowserExperimentSource(configUrl);
          setBrowserConfigQuery(configPath);
          resolve(source);
        } catch (error) {
          console.error(error);
          status.textContent = localeText.postSave.loadConfigFailed;
          setButtonsDisabled(buttons, false);
          input.focus();
        }
      })();
    });
  });
}

async function chooseDifferentExperimentSource(
  currentSource: ExperimentSource,
  localeText: LocaleText
): Promise<ExperimentSource | null> {
  if (
    currentSource.localConfigPath ||
    shouldUseTauriLocalConfig(window.location.search)
  ) {
    const selectedPath = await chooseTauriConfigPath();
    return selectedPath ? loadTauriExperimentSource(selectedPath) : null;
  }

  return requestBrowserExperimentSource(localeText);
}

function renderPostSaveScreen(
  message: string,
  localeText: LocaleText,
  currentSource: ExperimentSource
): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.replaceChildren();

  const container = document.createElement("main");
  container.className = "opjrd-status opjrd-post-save";
  disableContextMenu(container);

  const messageText = document.createElement("p");
  messageText.textContent = message;

  const actions = document.createElement("div");
  actions.className = "opjrd-config-picker-actions opjrd-post-save-actions";

  const runSameConfigButton = createActionButton(
    localeText.postSave.runSameConfigButtonLabel
  );
  const selectDifferentConfigButton = createActionButton(
    localeText.postSave.selectDifferentConfigButtonLabel
  );
  const buttons = [runSameConfigButton, selectDifferentConfigButton];
  const showBackToInitialScreenButton = Boolean(currentSource.localConfigPath);
  const backToInitialScreenButton = showBackToInitialScreenButton
    ? createActionButton(localeText.postSave.backToInitialScreenButtonLabel)
    : null;
  if (backToInitialScreenButton) {
    buttons.push(backToInitialScreenButton);
  }

  const status = document.createElement("p");
  status.className = "opjrd-config-picker-status";
  status.setAttribute("aria-live", "polite");

  actions.append(runSameConfigButton, selectDifferentConfigButton);
  if (backToInitialScreenButton) {
    actions.append(backToInitialScreenButton);
  }
  container.append(messageText, actions, status);
  app.append(container);

  const runAction = (action: () => Promise<void>): void => {
    setButtonsDisabled(buttons, true);
    status.textContent = "Loading...";
    void action().catch((error: unknown) => {
      console.error(error);
      status.textContent = localeText.postSave.loadConfigFailed;
      setButtonsDisabled(buttons, false);
    });
  };

  runSameConfigButton.addEventListener("click", () => {
    runAction(async () => {
      await runExperiment(await reloadExperimentSource(currentSource));
    });
  });

  selectDifferentConfigButton.addEventListener("click", () => {
    runAction(async () => {
      const source = await chooseDifferentExperimentSource(
        currentSource,
        localeText
      );
      if (source) {
        await runExperiment(source);
        return;
      }

      renderPostSaveScreen(
        localeText.postSave.noConfigSelected,
        localeText,
        currentSource
      );
    });
  });

  backToInitialScreenButton?.addEventListener("click", () => {
    runAction(startInitialExperimentFlow);
  });
}

function renderPendingSaveScreen(
  bundle: SaveBundle,
  saveAdapter: SaveAdapter,
  localeText: LocaleText,
  currentSource: ExperimentSource,
  initialStatus = ""
): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.replaceChildren();

  const container = document.createElement("main");
  container.className = "opjrd-start opjrd-finish opjrd-pending-save";
  disableContextMenu(container);

  const content = document.createElement("div");
  content.className = "opjrd-pending-save-content";

  const title = document.createElement("h1");
  title.textContent = localeText.instructions.finishTitle;

  const prompt = document.createElement("p");
  prompt.textContent = localeText.instructions.finishText;

  const saveButton = createActionButton(localeText.instructions.finishButtonLabel);
  saveButton.className = "jspsych-btn";

  const status = document.createElement("p");
  status.className = "opjrd-config-picker-status opjrd-pending-save-status";
  status.setAttribute("aria-live", "polite");
  status.textContent = initialStatus;

  content.append(title, prompt, saveButton, status);
  container.append(content);
  app.append(container);

  const attemptSave = async (): Promise<void> => {
    saveButton.disabled = true;
    status.textContent = localeText.status.saving;

    try {
      await saveAdapter.save(bundle);
      renderPostSaveScreen(
        savedStatusMessage(saveAdapter.name, Boolean(bundle.csv), localeText),
        localeText,
        currentSource
      );
    } catch (error) {
      const recovery = saveFailureRecovery(error, localeText);
      if (recovery.shouldLogError) {
        console.error(error);
      }
      status.textContent = recovery.statusMessage;
      saveButton.disabled = false;
      saveButton.focus();
    }
  };

  saveButton.addEventListener("click", () => {
    void attemptSave();
  });
}

interface MetadataFormControl {
  element: HTMLElement;
  focus: () => void;
  validate: () => boolean;
  value: () => [string, ParticipantMetadataValue];
}

function createTextMetadataControl(
  field: ParticipantMetadataFieldConfig,
  localeText: LocaleText
): MetadataFormControl {
  const label = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = field.label;

  const input = document.createElement("input");
  input.type = "text";
  input.name = field.name;
  input.required = true;
  input.autocomplete = "off";
  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });

  label.append(labelText, input);

  return {
    element: label,
    focus: () => {
      input.focus();
    },
    validate: () => {
      input.setCustomValidity("");
      if (!input.value.trim()) {
        input.setCustomValidity(localeText.metadata.fieldRequiredMessage);
      }
      return input.checkValidity();
    },
    value: () => [field.name, input.value.trim()],
  };
}

function createNumberMetadataControl(
  field: ParticipantMetadataFieldConfig,
  localeText: LocaleText
): MetadataFormControl {
  const label = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = field.label;

  const input = document.createElement("input");
  input.type = "number";
  input.name = field.name;
  input.required = true;
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });

  label.append(labelText, input);

  return {
    element: label,
    focus: () => {
      input.focus();
    },
    validate: () => {
      input.setCustomValidity("");
      if (!input.value.trim()) {
        input.setCustomValidity(localeText.metadata.fieldRequiredMessage);
      } else if (!input.validity.valid) {
        input.setCustomValidity(localeText.metadata.wholeNumberRequiredMessage);
      }
      return input.checkValidity();
    },
    value: () => [field.name, Number(input.value)],
  };
}

function createRadioMetadataControl(
  field: ParticipantMetadataFieldConfig,
  localeText: LocaleText
): MetadataFormControl {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "opjrd-metadata-radio-field";

  const legend = document.createElement("legend");
  legend.textContent = field.label;

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "opjrd-metadata-radio-options";

  const freeTextInputs = new Map<string, HTMLInputElement>();

  const radios = field.options.map((option, index) => {
    const optionLabel = document.createElement("label");
    optionLabel.className = "opjrd-metadata-radio-option";

    const value = option.freeText
      ? `__opjrd_free_text_${field.name}_${index}__`
      : option.label;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = field.name;
    radio.required = true;
    radio.value = value;

    const optionText = document.createElement("span");
    optionText.textContent = option.freeText ? `${option.label}:` : option.label;

    optionLabel.append(radio, optionText);
    if (option.freeText) {
      const freeTextInput = document.createElement("input");
      freeTextInput.type = "text";
      freeTextInput.name = `${field.name}_free_text_${index}`;
      freeTextInput.autocomplete = "off";
      freeTextInput.className = "opjrd-metadata-free-text";
      freeTextInput.addEventListener("input", () => {
        freeTextInput.setCustomValidity("");
      });
      freeTextInputs.set(value, freeTextInput);
      optionLabel.append(freeTextInput);
    }
    optionsContainer.append(optionLabel);

    return radio;
  });

  const selectedRadio = (): HTMLInputElement | undefined =>
    radios.find((radio) => radio.checked);
  const updateFreeTextState = (): void => {
    const selectedValue = selectedRadio()?.value;
    for (const [value, input] of freeTextInputs) {
      input.disabled = selectedValue !== value;
    }
  };
  const clearValidity = (): void => {
    for (const radio of radios) {
      radio.setCustomValidity("");
    }
    for (const input of freeTextInputs.values()) {
      input.setCustomValidity("");
    }
    updateFreeTextState();
  };

  for (const radio of radios) {
    radio.addEventListener("change", clearValidity);
  }
  updateFreeTextState();

  fieldset.append(legend, optionsContainer);

  return {
    element: fieldset,
    focus: () => {
      const selected = selectedRadio();
      const selectedFreeTextInput = selected
        ? freeTextInputs.get(selected.value)
        : undefined;
      if (selectedFreeTextInput) {
        selectedFreeTextInput.focus();
        return;
      }
      (selected ?? radios[0])?.focus();
    },
    validate: () => {
      for (const radio of radios) {
        radio.setCustomValidity("");
      }
      for (const input of freeTextInputs.values()) {
        input.setCustomValidity("");
      }

      const selected = selectedRadio();
      const selectedFreeTextInput = selected
        ? freeTextInputs.get(selected.value)
        : undefined;
      if (!selected) {
        for (const radio of radios) {
          radio.setCustomValidity(
            localeText.metadata.selectionRequiredMessage
          );
        }
      } else if (selectedFreeTextInput && !selectedFreeTextInput.value.trim()) {
        selectedFreeTextInput.setCustomValidity(
          localeText.metadata.freeTextRequiredMessage
        );
      }

      return (
        radios.every((radio) => radio.checkValidity()) &&
        Array.from(freeTextInputs.values()).every((input) =>
          input.checkValidity()
        )
      );
    },
    value: () => {
      const selected = selectedRadio();
      const selectedFreeTextInput = selected
        ? freeTextInputs.get(selected.value)
        : undefined;
      if (selectedFreeTextInput) {
        return [field.name, selectedFreeTextInput.value.trim()];
      }
      return [field.name, selected?.value ?? ""];
    },
  };
}

function createSelectMetadataControl(
  field: ParticipantMetadataFieldConfig,
  localeText: LocaleText
): MetadataFormControl {
  const label = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = field.label;

  const select = document.createElement("select");
  select.name = field.name;
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);

  for (const option of field.options) {
    const item = document.createElement("option");
    item.value = option.label;
    item.textContent = option.label;
    select.append(item);
  }

  select.addEventListener("change", () => {
    select.setCustomValidity("");
  });

  label.append(labelText, select);

  return {
    element: label,
    focus: () => {
      select.focus();
    },
    validate: () => {
      select.setCustomValidity("");
      if (!select.value) {
        select.setCustomValidity(localeText.metadata.selectionRequiredMessage);
      }
      return select.checkValidity();
    },
    value: () => [field.name, select.value],
  };
}

function createMetadataFormControl(
  field: ParticipantMetadataFieldConfig,
  localeText: LocaleText
): MetadataFormControl {
  switch (field.type) {
    case "number":
      return createNumberMetadataControl(field, localeText);
    case "radio":
      return createRadioMetadataControl(field, localeText);
    case "select":
      return createSelectMetadataControl(field, localeText);
    case "text":
      return createTextMetadataControl(field, localeText);
  }
}

function renderParticipantMetadataForm(
  configName: string,
  localeText: LocaleText,
  fields: readonly ParticipantMetadataFieldConfig[]
): Promise<Record<string, ParticipantMetadataValue>> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.replaceChildren();

  const container = document.createElement("main");
  container.className = "opjrd-start opjrd-metadata-form";
  disableContextMenu(container);

  const experimentName = document.createElement("p");
  experimentName.className = "opjrd-metadata-experiment";
  experimentName.textContent = configName;

  const heading = document.createElement("h1");
  heading.textContent = localeText.metadata.title;

  const form = document.createElement("form");
  form.className = "opjrd-metadata-fields";
  form.noValidate = true;

  const controls = fields.map((field) =>
    createMetadataFormControl(field, localeText)
  );
  for (const control of controls) {
    form.append(control.element);
  }

  const continueButton = createActionButton(
    localeText.metadata.continueButtonLabel
  );
  continueButton.type = "submit";
  form.append(continueButton);
  container.append(experimentName, heading, form);
  app.append(container);
  controls[0]?.focus();

  return new Promise((resolve) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let firstInvalid: MetadataFormControl | undefined;
      for (const control of controls) {
        if (!control.validate() && !firstInvalid) {
          firstInvalid = control;
        }
      }
      if (!form.reportValidity()) {
        firstInvalid?.focus();
        return;
      }

      resolve(Object.fromEntries(controls.map((control) => control.value())));
    });
  });
}

async function collectSessionParticipantMetadata(
  config: ExperimentSource["config"],
  localeText: LocaleText
): Promise<ParticipantMetadataBlock> {
  if (config.participantMetadata.provider === "form") {
    return collectParticipantMetadata(config, {
      formValues: await renderParticipantMetadataForm(
        config.experimentName,
        localeText,
        interactiveParticipantMetadataFields(config)
      ),
    });
  }

  return collectParticipantMetadata(config);
}

async function runExperiment(experimentSource: ExperimentSource): Promise<void> {
  setStatus("Loading OPJRD...");
  const { config } = experimentSource;
  document.title = config.experimentName;
  const [localeText, model, configHash, stimulusAssets] = await Promise.all([
    loadLocale(config.locale),
    loadExperimentModel(config, experimentSource.fileLoader),
    calculateConfigHash(config),
    loadStimulusAssets(config, experimentSource.fileLoader),
  ]);
  const saveAdapter = selectSaveAdapter(config);
  clearApp();
  const participantMetadata = await collectSessionParticipantMetadata(
    config,
    localeText
  );
  clearApp();

  const jsPsych = initJsPsych({
    display_element: "app",
    on_finish: () => {
      void (async () => {
        const rows = jsPsych.data
          .get()
          .filter({ opjrd_row: true })
          .values() as Record<string, unknown>[];
        const canonicalRows = canonicaliseTrialRows(rows);
        const session = await buildSessionEnvelope(
          config,
          experimentSource.configPath,
          configHash,
          canonicalRows,
          participantMetadata
        );
        const bundle = buildSaveBundle(config, session);

        try {
          await saveAdapter.save(bundle);
          renderPostSaveScreen(
            savedStatusMessage(saveAdapter.name, Boolean(bundle.csv), localeText),
            localeText,
            experimentSource
          );
        } catch (error) {
          const recovery = saveFailureRecovery(error, localeText);
          if (recovery.shouldLogError) {
            console.error(error);
          }
          renderPendingSaveScreen(
            bundle,
            saveAdapter,
            localeText,
            experimentSource,
            recovery.statusMessage
          );
        }
      })().catch((error: unknown) => {
        console.error(error);
        setStatus(localeText.status.saveFailed);
      });
    },
  });

  const fullscreenSettleTimeline =
    config.timing.firstTrialStartDelayMsec > 0
      ? [
          {
            type: HtmlKeyboardResponsePlugin,
            stimulus: `
              <main class="opjrd-fullscreen-settle" aria-hidden="true"></main>
            `,
            choices: "NO_KEYS",
            trial_duration: config.timing.firstTrialStartDelayMsec,
            response_ends_trial: false,
            data: { stage: "fullscreen_settle" },
          },
        ]
      : [];

  const timeline = [
    {
      type: HtmlKeyboardResponsePlugin,
      stimulus: `
        <main class="opjrd-start">
          <img
            class="opjrd-app-logo"
            src="${APP_LOGO_URL}"
            alt="OPJRD app icon"
            width="112"
            height="112"
          >
          <h1>${config.experimentName}</h1>
          <p>${localeText.instructions.readyText}</p>
        </main>
      `,
      choices: [" "],
      data: { stage: "instructions" },
      on_finish: () => {
        void prepareTrialRunPresentation();
      },
    },
    ...fullscreenSettleTimeline,
    ...buildModeTimeline(model, localeText, stimulusAssets),
    {
      type: HtmlButtonResponsePlugin,
      stimulus: `
        <main class="opjrd-start opjrd-finish">
          <h1>${localeText.instructions.finishTitle}</h1>
          <p>${localeText.instructions.finishText}</p>
        </main>
      `,
      choices: [localeText.instructions.finishButtonLabel],
      data: { stage: "finish" },
      on_start: () => {
        cleanupTrialRunPresentation();
        exitTrialFullscreen();
      },
    },
  ];

  await jsPsych.run(timeline as Parameters<typeof jsPsych.run>[0]);
}

async function startTauriInitialExperimentFlow(
  initialStatus = ""
): Promise<void> {
  let status = initialStatus;

  for (;;) {
    const source = await requestTauriExperimentSource(status);
    try {
      await runExperiment(source);
      return;
    } catch (error) {
      console.error(error);
      cleanupTrialRunPresentation();
      status = errorMessage(error, "Could not start experiment.");
    }
  }
}

async function startInitialExperimentFlow(): Promise<void> {
  if (shouldUseTauriLocalConfig(window.location.search)) {
    await startTauriInitialExperimentFlow();
    return;
  }
  setStatus("Loading OPJRD...");
  await runExperiment(await loadExperimentSource());
}

async function main(): Promise<void> {
  installTauriFullscreenAdapter();
  await startInitialExperimentFlow();
}

main().catch((error: unknown) => {
  console.error(error);
  cleanupTrialRunPresentation();
  setStatus(
    errorMessage(
      error,
      "Startup failed. Please check the config and browser console."
    )
  );
});
