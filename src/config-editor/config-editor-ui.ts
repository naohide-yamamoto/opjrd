import { availableLocales } from "virtual:opjrd-locales";
import { normaliseExperimentConfig } from "../core/config";
import {
  hasSupportedExperimentDataFileExtension,
  hasSupportedStimulusImageExtension,
} from "../core/file-validation";
import { unsupportedFilenameTemplateTokens } from "../core/filename-template";
import {
  CANVAS_SHAPES,
  LATENCY_START_EVENTS,
  PARTICIPANT_METADATA_FIELD_TYPES,
  PARTICIPANT_METADATA_PROVIDERS,
  SAVE_DESTINATIONS,
  STIMULUS_RENDERING_MODES,
  TASK_MODES,
  type CanvasDisplayConfig,
  type ExperimentConfig,
  type ParticipantMetadataFieldConfig,
  type ParticipantMetadataFieldOption,
  type TaskMode,
} from "../core/types";
import {
  configToJsonText,
  parseManualMetadataJson,
} from "./config-editor-model";

const AVAILABLE_LOCALES = [...availableLocales]
  .sort((a, b) => a.localeCompare(b));

export interface ConfigEditorOptions {
  chooseStimulusImage?: () => Promise<StimulusImageSelection | null>;
  initialConfig: ExperimentConfig;
  onBack: () => void;
  onSave: (configText: string) => Promise<boolean>;
  onSaved?: () => void;
  sourceLabel: string;
  validateExperimentDataFilePath?: (relativePath: string) => Promise<void>;
  validateStimulusImagePath?: (relativePath: string) => Promise<void>;
}

interface StimulusImageSelection {
  relativePath: string;
}

const SUPPORTED_STIMULUS_IMAGE_MESSAGE =
  "This image file format is not supported.";
const MISSING_STIMULUS_IMAGE_MESSAGE =
  "This image file does not exist in the experiment config folder.";
const SUPPORTED_EXPERIMENT_DATA_FILE_MESSAGE =
  "This file format is not supported.";
const MISSING_EXPERIMENT_DATA_FILE_MESSAGE =
  "This file does not exist in the experiment config folder.";

type EditorControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const fileExistenceValidationControllers = new WeakMap<
  HTMLInputElement,
  AbortController
>();

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function selected(value: string, selectedValue: string): string {
  return value === selectedValue ? " selected" : "";
}

function checked(value: boolean): string {
  return value ? " checked" : "";
}

function optionalNumberValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function localeValues(selectedLocale: string): readonly string[] {
  return AVAILABLE_LOCALES.includes(selectedLocale)
    ? AVAILABLE_LOCALES
    : [...AVAILABLE_LOCALES, selectedLocale].sort((a, b) => a.localeCompare(b));
}

function selectControl(
  name: string,
  label: string,
  values: readonly string[],
  selectedValue: string,
  className = ""
): string {
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return `
    <label${classAttribute}>
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}">
        ${values
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}"${selected(value, selectedValue)}>${escapeHtml(value)}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function textControl(
  name: string,
  label: string,
  value: unknown,
  className = ""
): string {
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return `
    <label${classAttribute}>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="text" value="${escapeHtml(value)}">
    </label>
  `;
}

function requiredTextControl(
  name: string,
  label: string,
  value: unknown,
  message: string
): string {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input
        name="${escapeHtml(name)}"
        type="text"
        value="${escapeHtml(value)}"
        required
        data-opjrd-required-text
        data-opjrd-required-message="${escapeHtml(message)}"
      >
    </label>
  `;
}

function numberControl(
  name: string,
  label: string,
  value: unknown,
  options = "step=\"any\""
): string {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="number" ${options} value="${escapeHtml(value)}">
    </label>
  `;
}

function requiredNumberControl(
  name: string,
  label: string,
  value: unknown,
  message: string
): string {
  return numberControl(
    name,
    label,
    value,
    `step="any" required data-opjrd-required-number data-opjrd-required-message="${escapeHtml(message)}"`
  );
}

function positiveNumberControl(
  name: string,
  label: string,
  value: unknown,
  options = "step=\"any\""
): string {
  return numberControl(
    name,
    label,
    value,
    `${options} data-opjrd-positive-number`
  );
}

function nonNegativeNumberControl(
  name: string,
  label: string,
  value: unknown,
  options = "step=\"any\""
): string {
  return numberControl(
    name,
    label,
    value,
    `${options} data-opjrd-non-negative-number`
  );
}

function optionalPositiveNumberControl(
  name: string,
  label: string,
  value: unknown
): string {
  return numberControl(
    name,
    label,
    value,
    "step=\"any\" data-opjrd-positive-number data-opjrd-optional-number"
  );
}

function colourControl(name: string, label: string, value: string): string {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="color" value="${escapeHtml(value)}">
    </label>
  `;
}

function checkboxControl(name: string, label: string, value: boolean): string {
  return `
    <label class="opjrd-settings-checkbox">
      <input name="${escapeHtml(name)}" type="checkbox"${checked(value)}>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function checkboxGroup(...items: string[]): string {
  return `<div class="opjrd-settings-checkbox-group">${items.join("")}</div>`;
}

function textareaControl(name: string, label: string, value: string): string {
  return `
    <label class="opjrd-settings-wide">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="3">${escapeHtml(value)}</textarea>
    </label>
  `;
}

const DEFAULT_STIMULUS_IMAGE_NAMES = ["A", "B", "C"] as const;

function stimulusImageEntries(images: Record<string, string>): [string, string][] {
  const entries = Object.entries(images);
  const names = new Set(entries.map(([name]) => name));
  for (const name of DEFAULT_STIMULUS_IMAGE_NAMES) {
    if (!names.has(name)) {
      entries.push([name, ""]);
    }
  }

  return entries;
}

function stimulusImageRow(
  objectName = "",
  imagePath = "",
  pickerAvailable: boolean
): string {
  return `
    <div class="opjrd-stimulus-image-row" data-opjrd-stimulus-image-row>
      <input
        name="response.stimuli.images.name"
        type="text"
        value="${escapeHtml(objectName)}"
        aria-label="Object name"
      >
      <input
        name="response.stimuli.images.path"
        type="text"
        value="${escapeHtml(imagePath)}"
        aria-label="Image path"
        data-opjrd-stimulus-image-path
      >
      <button
        type="button"
        data-opjrd-stimulus-image-choose
        ${pickerAvailable ? "" : "disabled"}
      >Choose image</button>
      <button
        type="button"
        aria-label="Remove object image row"
        data-opjrd-stimulus-image-remove
      >Remove</button>
    </div>
  `;
}

function stimulusImagesControl(
  images: Record<string, string>,
  pickerAvailable: boolean
): string {
  return `
    <div class="opjrd-stimulus-images opjrd-settings-wide" data-opjrd-stimulus-images>
      <div class="opjrd-stimulus-image-header" aria-hidden="true">
        <span>Object name</span>
        <span>Image file</span>
        <span></span>
        <span></span>
      </div>
      <div data-opjrd-stimulus-image-rows>
        ${stimulusImageEntries(images)
          .map(([name, path]) => stimulusImageRow(name, path, pickerAvailable))
          .join("")}
      </div>
      <button type="button" data-opjrd-stimulus-image-add>Add object image</button>
    </div>
  `;
}

function metadataFieldOptionRow(
  option: ParticipantMetadataFieldOption = { label: "", freeText: false }
): string {
  return `
    <div class="opjrd-metadata-field-option-row" data-opjrd-metadata-field-option-row>
      <input
        name="participantMetadata.fields.options.label"
        type="text"
        value="${escapeHtml(option.label)}"
        aria-label="Metadata option label"
        data-opjrd-metadata-option-label
      >
      <label class="opjrd-settings-checkbox opjrd-metadata-option-free-text">
        <input
          name="participantMetadata.fields.options.freeText"
          type="checkbox"
          ${checked(option.freeText)}
          data-opjrd-metadata-option-free-text
        >
        <span>Free-text entry</span>
      </label>
      <button
        type="button"
        aria-label="Remove metadata option row"
        data-opjrd-metadata-option-remove
      >Remove</button>
    </div>
  `;
}

function metadataFieldRow(
  field: ParticipantMetadataFieldConfig = {
    name: "",
    label: "",
    type: "text",
    options: [],
  }
): string {
  return `
    <div class="opjrd-metadata-field-row" data-opjrd-metadata-field-row>
      <div class="opjrd-metadata-field-main">
        <label>
          <span>Field name</span>
          <input
            name="participantMetadata.fields.name"
            type="text"
            value="${escapeHtml(field.name)}"
            data-opjrd-metadata-field-name
          >
        </label>
        <label>
          <span>Label</span>
          <input
            name="participantMetadata.fields.label"
            type="text"
            value="${escapeHtml(field.label)}"
            data-opjrd-metadata-field-label
          >
        </label>
        ${selectControl(
          "participantMetadata.fields.type",
          "Type",
          PARTICIPANT_METADATA_FIELD_TYPES,
          field.type,
          "opjrd-metadata-field-type-control"
        ).replace(
          "<select",
          '<select data-opjrd-metadata-field-type'
        )}
        <button
          type="button"
          aria-label="Remove metadata field row"
          data-opjrd-metadata-field-remove
        >Remove</button>
      </div>
      <div class="opjrd-metadata-field-options" data-opjrd-metadata-field-options>
        <div class="opjrd-metadata-field-option-header" aria-hidden="true">
          <span>Option label</span>
          <span></span>
          <span></span>
        </div>
        <div data-opjrd-metadata-field-option-rows>
          ${field.options
          .map((option) => metadataFieldOptionRow(option))
          .join("")}
        </div>
        <button type="button" data-opjrd-metadata-option-add>Add option</button>
      </div>
    </div>
  `;
}

function metadataFieldsControl(
  fields: readonly ParticipantMetadataFieldConfig[]
): string {
  return `
    <div class="opjrd-metadata-fields-editor opjrd-settings-wide" data-opjrd-metadata-fields>
      <span>Metadata fields</span>
      <div data-opjrd-metadata-field-rows>
        ${fields.map((field) => metadataFieldRow(field)).join("")}
      </div>
      <button type="button" data-opjrd-metadata-field-add>Add metadata field</button>
    </div>
  `;
}

function canvasFields(
  prefix: string,
  label: string,
  canvas: CanvasDisplayConfig,
  mode: TaskMode,
  currentMode: TaskMode
): string {
  const disabled = mode === currentMode ? "" : " disabled";
  return `
    <fieldset class="opjrd-settings-subsection opjrd-canvas-config" data-opjrd-canvas-mode="${escapeHtml(mode)}"${disabled}>
      <legend>${escapeHtml(label)}</legend>
      ${checkboxGroup(
        checkboxControl(`${prefix}.visible`, "Show canvas surface", canvas.visible)
      )}
      <div class="opjrd-settings-grid" data-opjrd-canvas-surface-fields>
        ${selectControl(`${prefix}.shape`, "Shape", CANVAS_SHAPES, canvas.shape)}
        ${positiveNumberControl(`${prefix}.sizePx`, "Size px", canvas.sizePx, "step=\"any\" data-opjrd-step-min=\"1\"")}
        ${positiveNumberControl(`${prefix}.widthPx`, "Rectangle width px", canvas.widthPx, "step=\"any\" data-opjrd-step-min=\"1\"")}
        ${positiveNumberControl(`${prefix}.heightPx`, "Rectangle height px", canvas.heightPx, "step=\"any\" data-opjrd-step-min=\"1\"")}
      </div>
    </fieldset>
  `;
}

function offsetControls(
  prefix: string,
  label: string,
  offset: { x: number; y: number }
): string {
  return `
    ${requiredNumberControl(`${prefix}.x`, `${label} offset x`, offset.x, "Enter an offset value.")}
    ${requiredNumberControl(`${prefix}.y`, `${label} offset y`, offset.y, "Enter an offset value.")}
  `;
}

function formHtml(
  config: ExperimentConfig,
  sourceLabel: string,
  pickerAvailable: boolean
): string {
  const manualValues = JSON.stringify(
    config.participantMetadata.manualValues,
    null,
    2
  );

  return `
    <main class="opjrd-settings-editor">
      <header class="opjrd-settings-header">
        <div>
          <p class="opjrd-settings-eyebrow">Settings editor</p>
          <h1>${escapeHtml(config.experimentName)}</h1>
          <p class="opjrd-settings-source">${escapeHtml(sourceLabel)}</p>
        </div>
        <div class="opjrd-settings-actions">
          <button type="button" data-opjrd-editor-back>Cancel</button>
          <button type="submit" form="opjrd-settings-form" data-opjrd-editor-save>Save config</button>
        </div>
      </header>
      <form id="opjrd-settings-form">
        <section class="opjrd-settings-section">
          <h2>Experiment</h2>
          ${checkboxGroup(
            checkboxControl("randomiseTrials", "Randomise trial order", config.randomiseTrials)
          )}
          <div class="opjrd-settings-grid">
            ${textControl("experimentName", "Experiment name", config.experimentName)}
            ${selectControl("taskMode", "Task mode", TASK_MODES, config.taskMode)}
            ${selectControl("locale", "Locale", localeValues(config.locale), config.locale)}
            ${requiredTextControl("locationsFile", "Locations file", config.locationsFile, "Enter a locations file path.")}
            ${requiredTextControl("trialsFile", "Trials file", config.trialsFile, "Enter a trials file path.")}
            ${requiredNumberControl("zeroDirection.x", "0-degree direction x", config.zeroDirection.x, "Enter a 0-degree direction x value.")}
            ${requiredNumberControl("zeroDirection.y", "0-degree direction y", config.zeroDirection.y, "Enter a 0-degree direction y value.")}
          </div>
        </section>

        <section class="opjrd-settings-section">
          <h2>Timing</h2>
          <div class="opjrd-settings-grid">
            ${nonNegativeNumberControl("timing.aToBDelayMsec", "A-to-B delay ms", config.timing.aToBDelayMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
            ${nonNegativeNumberControl("timing.bToCDelayMsec", "B-to-C delay ms", config.timing.bToCDelayMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
            ${selectControl("timing.latencyStartEvent", "Latency start", LATENCY_START_EVENTS, config.timing.latencyStartEvent)}
            ${nonNegativeNumberControl("timing.interTrialIntervalMsec", "Inter-trial interval ms", config.timing.interTrialIntervalMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
            ${nonNegativeNumberControl("timing.firstTrialStartDelayMsec", "First-trial delay ms", config.timing.firstTrialStartDelayMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
          </div>
        </section>

        <section class="opjrd-settings-section">
          <h2>Response Interface</h2>
          <div class="opjrd-settings-grid">
            ${positiveNumberControl("response.abDistance", "A-B response distance", config.response.abDistance, "step=\"any\" data-opjrd-step-min=\"1\"")}
            ${positiveNumberControl("response.layoutRadius", "Layout radius", config.response.layoutRadius, "step=\"any\" data-opjrd-step-min=\"1\"")}
            ${colourControl("response.feedback.colour", "Feedback colour", config.response.feedback.colour)}
            ${nonNegativeNumberControl("response.feedback.durationMsec", "Feedback duration ms", config.response.feedback.durationMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
          </div>
          ${canvasFields("response.canvas.objectPlacement", "Object-placement canvas", config.response.canvas.objectPlacement, "object_placement", config.taskMode)}
          ${canvasFields("response.canvas.jrd", "JRD canvas", config.response.canvas.jrd, "jrd", config.taskMode)}
        </section>

        <section class="opjrd-settings-section">
          <h2>Trial Start Gate</h2>
          ${checkboxGroup(
            checkboxControl("response.trialStartGate.enabled", "Use trial start gate", config.response.trialStartGate.enabled),
            checkboxControl("response.trialStartGate.warningEnabled", "Show start-gate warning", config.response.trialStartGate.warningEnabled)
          )}
          <div class="opjrd-settings-grid">
            ${textControl("response.trialStartGate.label", "Button label", config.response.trialStartGate.label)}
            ${numberControl("response.trialStartGate.position.x", "Button position x", config.response.trialStartGate.position.x)}
            ${numberControl("response.trialStartGate.position.y", "Button position y", config.response.trialStartGate.position.y)}
            ${optionalPositiveNumberControl("response.trialStartGate.widthPx", "Button width px", optionalNumberValue(config.response.trialStartGate.widthPx))}
            ${optionalPositiveNumberControl("response.trialStartGate.heightPx", "Button height px", optionalNumberValue(config.response.trialStartGate.heightPx))}
            ${nonNegativeNumberControl("response.trialStartGate.warningDelayMsec", "Warning delay ms", config.response.trialStartGate.warningDelayMsec, "step=\"any\" data-opjrd-step-min=\"0\"")}
            ${textareaControl("response.trialStartGate.warningMessage", "Warning message", config.response.trialStartGate.warningMessage)}
          </div>
        </section>

        <section class="opjrd-settings-section">
          <h2>Text</h2>
          <div class="opjrd-settings-grid">
            ${colourControl("response.text.objectLabels.colour", "Object label colour", config.response.text.objectLabels.colour)}
            ${positiveNumberControl("response.text.objectLabels.sizePx", "Object label size px", config.response.text.objectLabels.sizePx, "step=\"any\" data-opjrd-step-min=\"1\"")}
            ${textControl("response.text.objectLabels.fontFamily", "Object label font", config.response.text.objectLabels.fontFamily, "opjrd-settings-span-2")}
            ${colourControl("response.text.supportLabels.colour", "Support text colour", config.response.text.supportLabels.colour)}
            ${positiveNumberControl("response.text.supportLabels.sizePx", "Support text size px", config.response.text.supportLabels.sizePx, "step=\"any\" data-opjrd-step-min=\"1\"")}
            ${textControl("response.text.supportLabels.fontFamily", "Support text font", config.response.text.supportLabels.fontFamily, "opjrd-settings-span-2")}
            ${offsetControls("response.text.supportLabelOffsets.at", "At label", config.response.text.supportLabelOffsets.at)}
            ${offsetControls("response.text.supportLabelOffsets.facing", "Facing label", config.response.text.supportLabelOffsets.facing)}
            ${offsetControls("response.text.supportLabelOffsets.place", "Place label", config.response.text.supportLabelOffsets.place)}
            ${offsetControls("response.text.supportLabelOffsets.pointTo", "Point-to label", config.response.text.supportLabelOffsets.pointTo)}
          </div>
        </section>

        <section class="opjrd-settings-section">
          <h2>Stimuli</h2>
          <div class="opjrd-settings-grid">
            ${selectControl("response.stimuli.mode", "Object stimulus rendering", STIMULUS_RENDERING_MODES, config.response.stimuli.mode)}
            ${positiveNumberControl("response.stimuli.imageSizePx", "Image size px", config.response.stimuli.imageSizePx, "step=\"any\" data-opjrd-step-min=\"1\"")}
            ${stimulusImagesControl(config.response.stimuli.images, pickerAvailable)}
          </div>
        </section>

        <section class="opjrd-settings-section${config.taskMode === "object_placement" ? "" : " opjrd-settings-inactive"}" data-opjrd-object-placement-section>
          <h2>Object Placement</h2>
          ${checkboxGroup(
            checkboxControl("response.objectPlacement.requireMoveBeforeFinalise", "Require C movement before finalisation", config.response.objectPlacement.requireMoveBeforeFinalise)
          )}
          <div class="opjrd-settings-grid">
            ${requiredTextControl("response.objectPlacement.finalisationKey", "Finalisation key", config.response.objectPlacement.finalisationKey === " " ? "space" : config.response.objectPlacement.finalisationKey, "Specify the finalisation key.")}
            ${textareaControl("response.objectPlacement.moveRequiredWarningMessage", "Movement-required warning", config.response.objectPlacement.moveRequiredWarningMessage)}
            ${requiredNumberControl("response.objectPlacement.cInitialPosition.x", "Initial C position x", config.response.objectPlacement.cInitialPosition.x, "Enter an initial C position x value.")}
            ${requiredNumberControl("response.objectPlacement.cInitialPosition.y", "Initial C position y", config.response.objectPlacement.cInitialPosition.y, "Enter an initial C position y value.")}
          </div>
        </section>

        <section class="opjrd-settings-section">
          <h2>Save and Metadata</h2>
          ${checkboxGroup(
            checkboxControl("save.csvEnabled", "Export CSV as well as JSON", config.save.csvEnabled)
          )}
          <div class="opjrd-settings-grid">
            ${selectControl("save.destination", "Save destination", SAVE_DESTINATIONS, config.save.destination)}
            ${textControl("save.filenameTemplate", "Filename template", config.save.filenameTemplate, "opjrd-settings-wide-from-second")}
            ${selectControl("participantMetadata.provider", "Metadata provider", PARTICIPANT_METADATA_PROVIDERS, config.participantMetadata.provider)}
            ${textControl("participantMetadata.urlParameters", "URL metadata parameters", config.participantMetadata.urlParameters.join(", "), "opjrd-settings-wide-from-second")}
            ${metadataFieldsControl(config.participantMetadata.fields)}
            ${textareaControl("participantMetadata.manualValues", "Manual metadata JSON", manualValues)}
          </div>
        </section>
      </form>
      <p class="opjrd-settings-status" aria-live="polite"></p>
    </main>
  `;
}

function formText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function formNumber(formData: FormData, name: string): number {
  return Number(formText(formData, name));
}

function formOptionalNumber(formData: FormData, name: string): number | null {
  const value = formText(formData, name);
  return value === "" ? null : Number(value);
}

function formStimulusImages(formData: FormData): Record<string, string> {
  const names = formData
    .getAll("response.stimuli.images.name")
    .map((value) => String(value).trim());
  const paths = formData
    .getAll("response.stimuli.images.path")
    .map((value) => String(value).trim());
  const images: Record<string, string> = {};

  for (let index = 0; index < Math.max(names.length, paths.length); index += 1) {
    const name = names[index] ?? "";
    const path = paths[index] ?? "";

    if (!name && !path) {
      continue;
    }
    if (!path) {
      continue;
    }
    if (!name) {
      throw new Error("Enter an object name for each selected image.");
    }
    if (images[name]) {
      throw new Error(`Object image '${name}' is listed more than once.`);
    }

    images[name] = path;
  }

  return images;
}

function formMetadataFieldOptions(
  row: HTMLElement
): ParticipantMetadataFieldOption[] {
  return Array.from(
    row.querySelectorAll<HTMLElement>("[data-opjrd-metadata-field-option-row]")
  ).flatMap((optionRow) => {
    const labelInput = optionRow.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-option-label]"
    );
    const freeTextInput = optionRow.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-option-free-text]"
    );
    const label = labelInput?.value.trim() ?? "";
    if (!label) {
      return [];
    }
    return [
      {
        label,
        freeText: Boolean(freeTextInput?.checked),
      },
    ];
  });
}

function formMetadataFields(form: HTMLFormElement): ParticipantMetadataFieldConfig[] {
  return Array.from(
    form.querySelectorAll<HTMLElement>("[data-opjrd-metadata-field-row]")
  ).map((row) => {
    const name =
      row.querySelector<HTMLInputElement>("[data-opjrd-metadata-field-name]")
        ?.value.trim() ?? "";
    const label =
      row.querySelector<HTMLInputElement>("[data-opjrd-metadata-field-label]")
        ?.value.trim() ?? "";
    const type =
      row.querySelector<HTMLSelectElement>("[data-opjrd-metadata-field-type]")
        ?.value ?? "text";

    return {
      name,
      label,
      type: type as ParticipantMetadataFieldConfig["type"],
      options:
        type === "radio" || type === "select"
          ? formMetadataFieldOptions(row)
          : [],
    };
  });
}

function formBoolean(formData: FormData, name: string): boolean {
  return formData.has(name);
}

function formDataIncludingDisabledControls(form: HTMLFormElement): FormData {
  const disabledFieldsets = Array.from(
    form.querySelectorAll<HTMLFieldSetElement>("fieldset:disabled")
  );
  const disabledControls = Array.from(
    form.querySelectorAll<EditorControl>("input, select, textarea")
  ).filter((control) => control.disabled);

  for (const fieldset of disabledFieldsets) {
    fieldset.disabled = false;
  }
  for (const control of disabledControls) {
    control.disabled = false;
  }

  const formData = new FormData(form);

  for (const control of disabledControls) {
    control.disabled = true;
  }
  for (const fieldset of disabledFieldsets) {
    fieldset.disabled = true;
  }

  return formData;
}

function setControlsDisabled(
  container: Element | null,
  disabled: boolean
): void {
  if (!container) {
    return;
  }

  for (const control of container.querySelectorAll<EditorControl>(
    "input, select, textarea"
  )) {
    control.disabled = disabled;
  }
}

function clearInactiveLabels(container: Element | null): void {
  if (!container) {
    return;
  }

  for (const label of container.querySelectorAll<HTMLLabelElement>(
    "label.opjrd-settings-inactive"
  )) {
    label.classList.remove("opjrd-settings-inactive");
  }
}

function setControlDisabled(
  control: EditorControl | null,
  disabled: boolean,
  inactive = disabled
): void {
  if (!control) {
    return;
  }

  control.disabled = disabled;
  control.closest("label")?.classList.toggle("opjrd-settings-inactive", inactive);
}

function namedControl(
  form: HTMLFormElement,
  name: string
): EditorControl | null {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
    ? element
    : null;
}

function setNamedControlsDisabled(
  form: HTMLFormElement,
  names: readonly string[],
  disabled: boolean
): void {
  for (const name of names) {
    const control = namedControl(form, name);
    if (control) {
      setControlDisabled(control, disabled);
    }
  }
}

function setStimulusImageControlsDisabled(
  form: HTMLFormElement,
  disabled: boolean,
  pickerAvailable: boolean
): void {
  const container = form.querySelector<HTMLElement>("[data-opjrd-stimulus-images]");
  if (!container) {
    return;
  }

  container.classList.toggle("opjrd-settings-inactive", disabled);
  for (const control of container.querySelectorAll<HTMLInputElement>("input")) {
    control.disabled = disabled;
  }
  for (const button of container.querySelectorAll<HTMLButtonElement>("button")) {
    button.disabled =
      disabled ||
      (button.hasAttribute("data-opjrd-stimulus-image-choose") &&
        !pickerAvailable);
  }
}

function checkboxValue(form: HTMLFormElement, name: string): boolean {
  const control = namedControl(form, name);
  return control instanceof HTMLInputElement ? control.checked : false;
}

function addDependencyListener(
  form: HTMLFormElement,
  name: string,
  update: () => void
): void {
  namedControl(form, name)?.addEventListener("change", update);
}

function stimulusRowImagePath(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector<HTMLInputElement>(
    'input[name="response.stimuli.images.path"]'
  );
}

function stimulusRowObjectName(row: HTMLElement): HTMLInputElement | null {
  return row.querySelector<HTMLInputElement>(
    'input[name="response.stimuli.images.name"]'
  );
}

function imagePathValidityMessage(path: string): string {
  return path.trim().length > 0 && !hasSupportedStimulusImageExtension(path)
    ? SUPPORTED_STIMULUS_IMAGE_MESSAGE
    : "";
}

function experimentDataFileValidityMessage(input: HTMLInputElement): string {
  const path = input.value.trim();
  if (path.length === 0) {
    return input.dataset.opjrdRequiredMessage ?? "Enter a file path.";
  }

  return hasSupportedExperimentDataFileExtension(path)
    ? ""
    : SUPPORTED_EXPERIMENT_DATA_FILE_MESSAGE;
}

function experimentDataFileInputs(form: HTMLFormElement): HTMLInputElement[] {
  return ["locationsFile", "trialsFile"].flatMap((name) => {
    const input = namedControl(form, name);
    return input instanceof HTMLInputElement ? [input] : [];
  });
}

function cancelFileExistenceValidation(input: HTMLInputElement): void {
  const controller = fileExistenceValidationControllers.get(input);
  if (!controller) {
    return;
  }

  controller.abort();
  fileExistenceValidationControllers.delete(input);
}

function setExperimentDataFileInputValidity(input: HTMLInputElement): void {
  cancelFileExistenceValidation(input);
  input.setCustomValidity(experimentDataFileValidityMessage(input));
}

function refreshExperimentDataFileValidity(form: HTMLFormElement): void {
  for (const input of experimentDataFileInputs(form)) {
    setExperimentDataFileInputValidity(input);
  }
}

function installExperimentDataFileValidation(form: HTMLFormElement): void {
  for (const input of experimentDataFileInputs(form)) {
    const updateValidity = (): void => setExperimentDataFileInputValidity(input);

    input.addEventListener("input", updateValidity);
    updateValidity();
  }
}

async function validateExperimentDataFilePaths(
  form: HTMLFormElement,
  options: ConfigEditorOptions
): Promise<boolean> {
  for (const input of experimentDataFileInputs(form)) {
    if (input.disabled) {
      continue;
    }

    const pathMessage = experimentDataFileValidityMessage(input);
    if (pathMessage) {
      input.setCustomValidity(pathMessage);
      input.reportValidity();
      return false;
    }

    if (!options.validateExperimentDataFilePath) {
      continue;
    }

    try {
      await options.validateExperimentDataFilePath(input.value.trim());
      input.setCustomValidity("");
    } catch (error) {
      console.error(error);
      reportFileExistenceErrorUntilInteraction(
        input,
        MISSING_EXPERIMENT_DATA_FILE_MESSAGE,
        () => setExperimentDataFileInputValidity(input)
      );
      return false;
    }
  }

  return true;
}

function installStimulusImageRow(
  row: HTMLElement,
  options: ConfigEditorOptions,
  status: HTMLParagraphElement
): void {
  const objectNameInput = stimulusRowObjectName(row);
  const pathInput = stimulusRowImagePath(row);
  const chooseButton = row.querySelector<HTMLButtonElement>(
    "[data-opjrd-stimulus-image-choose]"
  );
  const removeButton = row.querySelector<HTMLButtonElement>(
    "[data-opjrd-stimulus-image-remove]"
  );

  const updateValidity = (): void => refreshStimulusImageRowValidity(row);

  chooseButton?.addEventListener("click", () => {
    void (async () => {
      if (!options.chooseStimulusImage || !pathInput) {
        return;
      }

      try {
        const selected = await options.chooseStimulusImage();
        if (!selected) {
          return;
        }
        pathInput.value = selected.relativePath;
        updateValidity();
        status.textContent = "Image selected.";
      } catch (error) {
        console.error(error);
        status.textContent =
          error instanceof Error ? error.message : "Could not choose image.";
      }
    })();
  });
  removeButton?.addEventListener("click", () => {
    row.remove();
  });
  objectNameInput?.addEventListener("input", updateValidity);
  pathInput?.addEventListener("input", updateValidity);
  updateValidity();
}

function refreshStimulusImageRowValidity(row: HTMLElement): void {
  const objectNameInput = stimulusRowObjectName(row);
  const pathInput = stimulusRowImagePath(row);
  const path = pathInput?.value.trim() ?? "";

  objectNameInput?.setCustomValidity(
    path && !objectNameInput.value.trim() ? "Enter an object name." : ""
  );
  if (pathInput) {
    cancelFileExistenceValidation(pathInput);
    pathInput.setCustomValidity(imagePathValidityMessage(path));
  }
}

function refreshStimulusImageValidity(form: HTMLFormElement): void {
  for (const row of form.querySelectorAll<HTMLElement>(
    "[data-opjrd-stimulus-image-row]"
  )) {
    refreshStimulusImageRowValidity(row);
  }
}

function refreshFilePathValidityForSave(form: HTMLFormElement): void {
  refreshExperimentDataFileValidity(form);
  refreshStimulusImageValidity(form);
}

function filenameTemplateEditorValidityMessage(template: string): string {
  const unsupportedTokens = unsupportedFilenameTemplateTokens(template);
  if (unsupportedTokens.length === 0) {
    return "";
  }

  const tokens = unsupportedTokens.map((token) => `{${token}}`).join(", ");
  return `${tokens} cannot be used in the filename.`;
}

function refreshFilenameTemplateValidity(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>(
    'input[name="save.filenameTemplate"]'
  );
  input?.setCustomValidity(
    filenameTemplateEditorValidityMessage(input.value.trim())
  );
}

function reportFileExistenceErrorUntilInteraction(
  input: HTMLInputElement,
  message: string,
  refreshValidity: () => void
): void {
  cancelFileExistenceValidation(input);
  const controller = new AbortController();
  fileExistenceValidationControllers.set(input, controller);
  const clearValidity = (): void => {
    cancelFileExistenceValidation(input);
    refreshValidity();
  };
  const addFocusClearHandler = (): void => {
    if (controller.signal.aborted) {
      return;
    }
    if (document.activeElement === input) {
      input.addEventListener(
        "blur",
        () => {
          if (!controller.signal.aborted) {
            input.addEventListener("focus", clearValidity, {
              once: true,
              signal: controller.signal,
            });
          }
        },
        { once: true, signal: controller.signal }
      );
      return;
    }
    input.addEventListener("focus", clearValidity, {
      once: true,
      signal: controller.signal,
    });
  };

  input.addEventListener("pointerdown", clearValidity, {
    once: true,
    signal: controller.signal,
  });
  input.addEventListener("input", clearValidity, {
    once: true,
    signal: controller.signal,
  });
  window.setTimeout(addFocusClearHandler, 0);

  input.setCustomValidity("");
  input.setCustomValidity(message);
  input.reportValidity();
}

async function validateStimulusImagePaths(
  form: HTMLFormElement,
  options: ConfigEditorOptions
): Promise<boolean> {
  const stimulusModeControl = namedControl(form, "response.stimuli.mode");
  if (
    !(stimulusModeControl instanceof HTMLSelectElement) ||
    stimulusModeControl.value !== "image"
  ) {
    return true;
  }

  for (const row of form.querySelectorAll<HTMLElement>(
    "[data-opjrd-stimulus-image-row]"
  )) {
    const pathInput = stimulusRowImagePath(row);
    const path = pathInput?.value.trim() ?? "";
    if (!pathInput || pathInput.disabled || !path) {
      continue;
    }

    const pathMessage = imagePathValidityMessage(path);
    if (pathMessage) {
      pathInput.setCustomValidity(pathMessage);
      pathInput.reportValidity();
      return false;
    }

    if (!options.validateStimulusImagePath) {
      continue;
    }

    try {
      await options.validateStimulusImagePath(path);
      pathInput.setCustomValidity("");
    } catch (error) {
      console.error(error);
      reportFileExistenceErrorUntilInteraction(
        pathInput,
        MISSING_STIMULUS_IMAGE_MESSAGE,
        () => refreshStimulusImageRowValidity(row)
      );
      return false;
    }
  }

  return true;
}

function installStimulusImageControls(
  form: HTMLFormElement,
  options: ConfigEditorOptions,
  status: HTMLParagraphElement,
  updateDependencies: () => void
): void {
  const container = form.querySelector<HTMLElement>("[data-opjrd-stimulus-images]");
  const rows = container?.querySelector<HTMLElement>(
    "[data-opjrd-stimulus-image-rows]"
  );
  const addButton = container?.querySelector<HTMLButtonElement>(
    "[data-opjrd-stimulus-image-add]"
  );

  if (!container || !rows || !addButton) {
    return;
  }

  const installRows = (): void => {
    for (const row of rows.querySelectorAll<HTMLElement>(
      "[data-opjrd-stimulus-image-row]:not([data-opjrd-stimulus-image-installed])"
    )) {
      row.dataset.opjrdStimulusImageInstalled = "true";
      installStimulusImageRow(row, options, status);
    }
  };

  addButton.addEventListener("click", () => {
    rows.insertAdjacentHTML(
      "beforeend",
      stimulusImageRow("", "", Boolean(options.chooseStimulusImage))
    );
    installRows();
    updateDependencies();
  });

  installRows();
}

function metadataFieldRowType(row: HTMLElement): HTMLSelectElement | null {
  return row.querySelector<HTMLSelectElement>("[data-opjrd-metadata-field-type]");
}

function refreshMetadataFieldRowControls(row: HTMLElement): void {
  const type = metadataFieldRowType(row)?.value ?? "text";
  const optionsContainer = row.querySelector<HTMLElement>(
    "[data-opjrd-metadata-field-options]"
  );
  const optionRows = Array.from(
    row.querySelectorAll<HTMLElement>("[data-opjrd-metadata-field-option-row]")
  );
  const optionInputs = optionRows.flatMap((optionRow) =>
    Array.from(optionRow.querySelectorAll<EditorControl>("input, select, textarea"))
  );
  const usesOptions = type === "radio" || type === "select";

  if (optionsContainer) {
    optionsContainer.hidden = !usesOptions;
  }
  for (const input of optionInputs) {
    input.disabled = !usesOptions;
  }

  for (const optionRow of optionRows) {
    const labelInput = optionRow.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-option-label]"
    );
    const freeTextInput = optionRow.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-option-free-text]"
    );

    if (labelInput) {
      labelInput.setCustomValidity(
        usesOptions && labelInput.value.trim().length === 0
          ? "Enter a metadata option label."
          : ""
      );
    }
    if (freeTextInput) {
      freeTextInput.disabled = !usesOptions || type === "select";
      if (type === "select") {
        freeTextInput.checked = false;
      }
      freeTextInput
        .closest("label")
        ?.classList.toggle("opjrd-settings-inactive", type === "select");
    }
  }

  const typeControl = metadataFieldRowType(row);
  if (typeControl) {
    typeControl.setCustomValidity(
      usesOptions && optionRows.length === 0
        ? "Add at least one metadata option."
        : ""
    );
  }
}

function refreshMetadataFieldValidity(form: HTMLFormElement): void {
  const seenNames = new Set<string>();
  for (const row of form.querySelectorAll<HTMLElement>(
    "[data-opjrd-metadata-field-row]"
  )) {
    const nameInput = row.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-field-name]"
    );
    const labelInput = row.querySelector<HTMLInputElement>(
      "[data-opjrd-metadata-field-label]"
    );

    nameInput?.setCustomValidity(
      nameInput.value.trim().length === 0
        ? "Enter a metadata field name."
        : ""
    );
    labelInput?.setCustomValidity(
      labelInput.value.trim().length === 0
        ? "Enter a metadata field label."
        : ""
    );

    const name = nameInput?.value.trim() ?? "";
    if (name) {
      if (seenNames.has(name)) {
        nameInput?.setCustomValidity(
          "Metadata field names must be unique."
        );
      }
      seenNames.add(name);
    }

    refreshMetadataFieldRowControls(row);
  }
}

function installMetadataOptionRow(
  optionRow: HTMLElement,
  updateValidity: () => void
): void {
  optionRow.dataset.opjrdMetadataOptionInstalled = "true";
  optionRow
    .querySelector<HTMLButtonElement>("[data-opjrd-metadata-option-remove]")
    ?.addEventListener("click", () => {
      optionRow.remove();
      updateValidity();
    });
  for (const input of optionRow.querySelectorAll<HTMLInputElement>("input")) {
    input.addEventListener("input", updateValidity);
    input.addEventListener("change", updateValidity);
  }
}

function installMetadataFieldRow(
  row: HTMLElement,
  form: HTMLFormElement
): void {
  row.dataset.opjrdMetadataFieldInstalled = "true";
  const optionRowsContainer = row.querySelector<HTMLElement>(
    "[data-opjrd-metadata-field-option-rows]"
  );
  const addOptionButton = row.querySelector<HTMLButtonElement>(
    "[data-opjrd-metadata-option-add]"
  );
  const updateValidity = (): void => refreshMetadataFieldValidity(form);
  const installOptionRows = (): void => {
    for (const optionRow of row.querySelectorAll<HTMLElement>(
      "[data-opjrd-metadata-field-option-row]:not([data-opjrd-metadata-option-installed])"
    )) {
      installMetadataOptionRow(optionRow, updateValidity);
    }
  };

  row
    .querySelector<HTMLButtonElement>("[data-opjrd-metadata-field-remove]")
    ?.addEventListener("click", () => {
      row.remove();
      updateValidity();
    });
  for (const control of row.querySelectorAll<EditorControl>(
    "input, select, textarea"
  )) {
    control.addEventListener("input", updateValidity);
    control.addEventListener("change", updateValidity);
  }
  addOptionButton?.addEventListener("click", () => {
    optionRowsContainer?.insertAdjacentHTML(
      "beforeend",
      metadataFieldOptionRow()
    );
    installOptionRows();
    updateValidity();
  });

  installOptionRows();
  refreshMetadataFieldRowControls(row);
}

function installMetadataFieldControls(form: HTMLFormElement): void {
  const container = form.querySelector<HTMLElement>("[data-opjrd-metadata-fields]");
  const rows = container?.querySelector<HTMLElement>(
    "[data-opjrd-metadata-field-rows]"
  );
  const addButton = container?.querySelector<HTMLButtonElement>(
    "[data-opjrd-metadata-field-add]"
  );

  if (!container || !rows || !addButton) {
    return;
  }

  const installRows = (): void => {
    for (const row of rows.querySelectorAll<HTMLElement>(
      "[data-opjrd-metadata-field-row]:not([data-opjrd-metadata-field-installed])"
    )) {
      installMetadataFieldRow(row, form);
    }
    refreshMetadataFieldValidity(form);
  };

  addButton.addEventListener("click", () => {
    rows.insertAdjacentHTML("beforeend", metadataFieldRow());
    installRows();
  });

  installRows();
}

function positiveNumberValidityMessage(input: HTMLInputElement): string {
  const value = input.value.trim();
  if (value.length === 0) {
    return input.dataset.opjrdOptionalNumber === undefined
      ? "Enter a number greater than 0."
      : "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? ""
    : "Enter a number greater than 0.";
}

function installPositiveNumberValidation(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    "input[data-opjrd-positive-number]"
  )) {
    const updateValidity = (): void => {
      input.setCustomValidity(positiveNumberValidityMessage(input));
    };

    input.addEventListener("input", updateValidity);
    updateValidity();
  }
}

function nonNegativeNumberValidityMessage(input: HTMLInputElement): string {
  const value = input.value.trim();
  const numericValue = Number(value);
  return value.length > 0 && Number.isFinite(numericValue) && numericValue >= 0
    ? ""
    : "Enter a number greater than or equal to 0.";
}

function installNonNegativeNumberValidation(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    "input[data-opjrd-non-negative-number]"
  )) {
    const updateValidity = (): void => {
      input.setCustomValidity(nonNegativeNumberValidityMessage(input));
    };

    input.addEventListener("input", updateValidity);
    updateValidity();
  }
}

function numberValidityMessage(input: HTMLInputElement): string {
  return input.dataset.opjrdNonNegativeNumber === undefined
    ? positiveNumberValidityMessage(input)
    : nonNegativeNumberValidityMessage(input);
}

function installStepMinimumGuards(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    "input[data-opjrd-step-min]"
  )) {
    const minimum = Number(input.dataset.opjrdStepMin);
    if (!Number.isFinite(minimum)) {
      continue;
    }

    let manualEditInProgress = false;
    const markManualEdit = (): void => {
      manualEditInProgress = true;
    };
    const clampSteppedValue = (): void => {
      if (manualEditInProgress) {
        manualEditInProgress = false;
        return;
      }

      const value = Number(input.value);
      if (
        input.value.trim().length > 0 &&
        Number.isFinite(value) &&
        value < minimum
      ) {
        input.value = String(minimum);
        input.setCustomValidity(numberValidityMessage(input));
      }
    };

    input.addEventListener("beforeinput", markManualEdit);
    input.addEventListener("paste", markManualEdit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        const value = Number(input.value);
        if (Number.isFinite(value) && value - 1 < minimum) {
          event.preventDefault();
          input.value = String(minimum);
          input.setCustomValidity(numberValidityMessage(input));
        }
        return;
      }

      if (
        event.key.length === 1 ||
        event.key === "Backspace" ||
        event.key === "Delete"
      ) {
        markManualEdit();
      }
    });
    input.addEventListener("input", clampSteppedValue);
  }
}

function installRequiredTextValidation(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    "input[data-opjrd-required-text]"
  )) {
    const updateValidity = (): void => {
      input.setCustomValidity(
        input.value.trim().length > 0
          ? ""
          : (input.dataset.opjrdRequiredMessage ?? "Enter a value.")
      );
    };

    input.addEventListener("input", updateValidity);
    updateValidity();
  }
}

function installRequiredNumberValidation(form: HTMLFormElement): void {
  for (const input of form.querySelectorAll<HTMLInputElement>(
    "input[data-opjrd-required-number]"
  )) {
    if (input.name === "zeroDirection.y") {
      continue;
    }

    const updateValidity = (): void => {
      input.setCustomValidity(
        input.value.trim().length > 0
          ? ""
          : (input.dataset.opjrdRequiredMessage ?? "Enter a number.")
      );
    };

    input.addEventListener("input", updateValidity);
    updateValidity();
  }
}

function installZeroDirectionValidation(form: HTMLFormElement): void {
  const xInput = namedControl(form, "zeroDirection.x");
  const yInput = namedControl(form, "zeroDirection.y");
  if (!(xInput instanceof HTMLInputElement) || !(yInput instanceof HTMLInputElement)) {
    return;
  }

  const updateValidity = (): void => {
    const xText = xInput.value.trim();
    const yText = yInput.value.trim();
    if (yText.length === 0) {
      yInput.setCustomValidity(
        yInput.dataset.opjrdRequiredMessage ??
          "Enter a 0-degree direction y value."
      );
      return;
    }

    const xValue = Number(xText);
    const yValue = Number(yText);
    yInput.setCustomValidity(
      xText.length > 0 &&
        Number.isFinite(xValue) &&
        Number.isFinite(yValue) &&
        xValue === 0 &&
        yValue === 0
        ? "0-degree direction x and y cannot both be 0."
        : ""
    );
  };

  xInput.addEventListener("input", updateValidity);
  yInput.addEventListener("input", updateValidity);
  updateValidity();
}

function disableContextMenu(element: Element): void {
  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

export function configFromEditorForm(form: HTMLFormElement): ExperimentConfig {
  const formData = formDataIncludingDisabledControls(form);
  const taskMode = formText(formData, "taskMode");
  const objectPlacementResponse =
    taskMode === "object_placement"
      ? {
          objectPlacement: {
            finalisationKey: formText(
              formData,
              "response.objectPlacement.finalisationKey"
            ),
            requireMoveBeforeFinalise: formBoolean(
              formData,
              "response.objectPlacement.requireMoveBeforeFinalise"
            ),
            moveRequiredWarningMessage: formText(
              formData,
              "response.objectPlacement.moveRequiredWarningMessage"
            ),
            cInitialPosition: {
              x: formNumber(
                formData,
                "response.objectPlacement.cInitialPosition.x"
              ),
              y: formNumber(
                formData,
                "response.objectPlacement.cInitialPosition.y"
              ),
            },
          },
        }
      : {};
  const rawConfig = {
    experimentName: formText(formData, "experimentName"),
    taskMode,
    locale: formText(formData, "locale"),
    locationsFile: formText(formData, "locationsFile"),
    trialsFile: formText(formData, "trialsFile"),
    zeroDirection: {
      x: formNumber(formData, "zeroDirection.x"),
      y: formNumber(formData, "zeroDirection.y"),
    },
    randomiseTrials: formBoolean(formData, "randomiseTrials"),
    timing: {
      aToBDelayMsec: formNumber(formData, "timing.aToBDelayMsec"),
      bToCDelayMsec: formNumber(formData, "timing.bToCDelayMsec"),
      latencyStartEvent: formText(formData, "timing.latencyStartEvent"),
      interTrialIntervalMsec: formNumber(
        formData,
        "timing.interTrialIntervalMsec"
      ),
      firstTrialStartDelayMsec: formNumber(
        formData,
        "timing.firstTrialStartDelayMsec"
      ),
    },
    response: {
      abDistance: formNumber(formData, "response.abDistance"),
      layoutRadius: formNumber(
        formData,
        "response.layoutRadius"
      ),
      canvas: {
        objectPlacement: {
          shape: formText(formData, "response.canvas.objectPlacement.shape"),
          sizePx: formNumber(formData, "response.canvas.objectPlacement.sizePx"),
          widthPx: formNumber(formData, "response.canvas.objectPlacement.widthPx"),
          heightPx: formNumber(
            formData,
            "response.canvas.objectPlacement.heightPx"
          ),
          visible: formBoolean(
            formData,
            "response.canvas.objectPlacement.visible"
          ),
        },
        jrd: {
          shape: formText(formData, "response.canvas.jrd.shape"),
          sizePx: formNumber(formData, "response.canvas.jrd.sizePx"),
          widthPx: formNumber(formData, "response.canvas.jrd.widthPx"),
          heightPx: formNumber(formData, "response.canvas.jrd.heightPx"),
          visible: formBoolean(formData, "response.canvas.jrd.visible"),
        },
      },
      trialStartGate: {
        enabled: formBoolean(formData, "response.trialStartGate.enabled"),
        label: formText(formData, "response.trialStartGate.label"),
        position: {
          x: formNumber(formData, "response.trialStartGate.position.x"),
          y: formNumber(formData, "response.trialStartGate.position.y"),
        },
        widthPx: formOptionalNumber(formData, "response.trialStartGate.widthPx"),
        heightPx: formOptionalNumber(
          formData,
          "response.trialStartGate.heightPx"
        ),
        warningEnabled: formBoolean(
          formData,
          "response.trialStartGate.warningEnabled"
        ),
        warningDelayMsec: formNumber(
          formData,
          "response.trialStartGate.warningDelayMsec"
        ),
        warningMessage: formText(
          formData,
          "response.trialStartGate.warningMessage"
        ),
      },
      feedback: {
        colour: formText(formData, "response.feedback.colour"),
        durationMsec: formNumber(formData, "response.feedback.durationMsec"),
      },
      text: {
        objectLabels: {
          colour: formText(formData, "response.text.objectLabels.colour"),
          sizePx: formNumber(formData, "response.text.objectLabels.sizePx"),
          fontFamily: formText(formData, "response.text.objectLabels.fontFamily"),
        },
        supportLabels: {
          colour: formText(formData, "response.text.supportLabels.colour"),
          sizePx: formNumber(formData, "response.text.supportLabels.sizePx"),
          fontFamily: formText(formData, "response.text.supportLabels.fontFamily"),
        },
        supportLabelOffsets: {
          at: {
            x: formNumber(formData, "response.text.supportLabelOffsets.at.x"),
            y: formNumber(formData, "response.text.supportLabelOffsets.at.y"),
          },
          facing: {
            x: formNumber(formData, "response.text.supportLabelOffsets.facing.x"),
            y: formNumber(formData, "response.text.supportLabelOffsets.facing.y"),
          },
          place: {
            x: formNumber(formData, "response.text.supportLabelOffsets.place.x"),
            y: formNumber(formData, "response.text.supportLabelOffsets.place.y"),
          },
          pointTo: {
            x: formNumber(formData, "response.text.supportLabelOffsets.pointTo.x"),
            y: formNumber(formData, "response.text.supportLabelOffsets.pointTo.y"),
          },
        },
      },
      stimuli: {
        mode: formText(formData, "response.stimuli.mode"),
        imageSizePx: formNumber(formData, "response.stimuli.imageSizePx"),
        images: formStimulusImages(formData),
      },
      ...objectPlacementResponse,
    },
    save: {
      destination: formText(formData, "save.destination"),
      csvEnabled: formBoolean(formData, "save.csvEnabled"),
      filenameTemplate: formText(formData, "save.filenameTemplate"),
    },
    participantMetadata: {
      provider: formText(formData, "participantMetadata.provider"),
      fields: formMetadataFields(form),
      urlParameters: formText(formData, "participantMetadata.urlParameters")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      manualValues: parseManualMetadataJson(
        formText(formData, "participantMetadata.manualValues")
      ),
    },
  };

  return normaliseExperimentConfig(rawConfig);
}

export function renderConfigEditor(options: ConfigEditorOptions): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("OPJRD app root is missing.");
  }

  app.innerHTML = formHtml(
    options.initialConfig,
    options.sourceLabel,
    Boolean(options.chooseStimulusImage)
  );

  const editor = app.querySelector<HTMLElement>(".opjrd-settings-editor");
  const form = app.querySelector<HTMLFormElement>("#opjrd-settings-form");
  const status = app.querySelector<HTMLParagraphElement>(".opjrd-settings-status");
  const heading = app.querySelector<HTMLHeadingElement>(".opjrd-settings-header h1");
  const backButton = app.querySelector<HTMLButtonElement>(
    "[data-opjrd-editor-back]"
  );
  const saveButton = app.querySelector<HTMLButtonElement>(
    "[data-opjrd-editor-save]"
  );
  if (!editor || !form || !status || !heading || !backButton || !saveButton) {
    throw new Error("OPJRD settings editor could not be created.");
  }
  disableContextMenu(editor);

  installPositiveNumberValidation(form);
  installNonNegativeNumberValidation(form);
  installStepMinimumGuards(form);
  installRequiredTextValidation(form);
  installExperimentDataFileValidation(form);
  installRequiredNumberValidation(form);
  installZeroDirectionValidation(form);

  const trialStartGateControlNames = [
    "response.trialStartGate.label",
    "response.trialStartGate.position.x",
    "response.trialStartGate.position.y",
    "response.trialStartGate.widthPx",
    "response.trialStartGate.heightPx",
  ];
  const trialStartGateWarningControlNames = [
    "response.trialStartGate.warningDelayMsec",
    "response.trialStartGate.warningMessage",
  ];
  const updateEditorDependencies = (): void => {
    const selectedTaskMode = form.elements.namedItem("taskMode");
    const taskMode =
      selectedTaskMode instanceof HTMLSelectElement
        ? selectedTaskMode.value
        : options.initialConfig.taskMode;

    for (const section of form.querySelectorAll<HTMLFieldSetElement>(
      "[data-opjrd-canvas-mode]"
    )) {
      const sectionDisabled = section.dataset.opjrdCanvasMode !== taskMode;
      section.disabled = sectionDisabled;

      const visibleToggle = section.querySelector<HTMLInputElement>(
        'input[type="checkbox"][name$=".visible"]'
      );
      const surfaceFields = section.querySelector<HTMLElement>(
        "[data-opjrd-canvas-surface-fields]"
      );
      const shapeControl = section.querySelector<HTMLSelectElement>(
        'select[name$=".shape"]'
      );
      const sizeControl = section.querySelector<HTMLInputElement>(
        'input[name$=".sizePx"]'
      );
      const widthControl = section.querySelector<HTMLInputElement>(
        'input[name$=".widthPx"]'
      );
      const heightControl = section.querySelector<HTMLInputElement>(
        'input[name$=".heightPx"]'
      );

      if (sectionDisabled) {
        setControlsDisabled(surfaceFields, false);
        surfaceFields?.classList.remove("opjrd-settings-inactive");
        clearInactiveLabels(surfaceFields);
        continue;
      }

      if (!visibleToggle?.checked) {
        setControlsDisabled(surfaceFields, true);
        surfaceFields?.classList.add("opjrd-settings-inactive");
        clearInactiveLabels(surfaceFields);
        continue;
      }

      const rectangleSelected = shapeControl?.value === "rectangle";
      surfaceFields?.classList.remove("opjrd-settings-inactive");
      setControlDisabled(shapeControl, false, false);
      setControlDisabled(sizeControl, rectangleSelected);
      setControlDisabled(widthControl, !rectangleSelected);
      setControlDisabled(heightControl, !rectangleSelected);
    }

    const trialStartGateEnabled = checkboxValue(
      form,
      "response.trialStartGate.enabled"
    );
    const trialStartGateWarningEnabled = checkboxValue(
      form,
      "response.trialStartGate.warningEnabled"
    );
    setNamedControlsDisabled(
      form,
      trialStartGateControlNames,
      !trialStartGateEnabled
    );
    setNamedControlsDisabled(
      form,
      ["response.trialStartGate.warningEnabled"],
      !trialStartGateEnabled
    );
    setNamedControlsDisabled(
      form,
      trialStartGateWarningControlNames,
      !trialStartGateEnabled || !trialStartGateWarningEnabled
    );

    const objectPlacementSection = form.querySelector<HTMLElement>(
      "[data-opjrd-object-placement-section]"
    );
    const objectPlacementActive = taskMode === "object_placement";
    objectPlacementSection?.classList.toggle(
      "opjrd-settings-inactive",
      !objectPlacementActive
    );
    setControlsDisabled(objectPlacementSection, !objectPlacementActive);
    if (objectPlacementActive) {
      setNamedControlsDisabled(
        form,
        ["response.objectPlacement.moveRequiredWarningMessage"],
        !checkboxValue(
          form,
          "response.objectPlacement.requireMoveBeforeFinalise"
        )
      );
    }

    const stimulusImageMode =
      formText(new FormData(form), "response.stimuli.mode") === "image";
    setNamedControlsDisabled(
      form,
      ["response.stimuli.imageSizePx"],
      !stimulusImageMode
    );
    setStimulusImageControlsDisabled(
      form,
      !stimulusImageMode,
      Boolean(options.chooseStimulusImage)
    );
  };

  form
    .querySelector<HTMLSelectElement>('select[name="taskMode"]')
    ?.addEventListener("change", updateEditorDependencies);
  for (const checkbox of form.querySelectorAll<HTMLInputElement>(
    '[data-opjrd-canvas-mode] input[type="checkbox"][name$=".visible"]'
  )) {
    checkbox.addEventListener("change", updateEditorDependencies);
  }
  for (const select of form.querySelectorAll<HTMLSelectElement>(
    '[data-opjrd-canvas-mode] select[name$=".shape"]'
  )) {
    select.addEventListener("change", updateEditorDependencies);
  }
  addDependencyListener(
    form,
    "response.trialStartGate.enabled",
    updateEditorDependencies
  );
  addDependencyListener(
    form,
    "response.trialStartGate.warningEnabled",
    updateEditorDependencies
  );
  addDependencyListener(
    form,
    "response.objectPlacement.requireMoveBeforeFinalise",
    updateEditorDependencies
  );
  addDependencyListener(form, "response.stimuli.mode", updateEditorDependencies);
  installMetadataFieldControls(form);
  installStimulusImageControls(form, options, status, updateEditorDependencies);
  updateEditorDependencies();
  form
    .querySelector<HTMLInputElement>('input[name="save.filenameTemplate"]')
    ?.addEventListener("input", () => {
      refreshFilenameTemplateValidity(form);
    });

  backButton.addEventListener("click", () => {
    options.onBack();
  });
  const clearStaleFilePathValidity = (): void => {
    refreshFilePathValidityForSave(form);
  };
  saveButton.addEventListener("pointerdown", clearStaleFilePathValidity);
  saveButton.addEventListener("click", clearStaleFilePathValidity);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      status.textContent = "Preparing config...";
      try {
        refreshFilePathValidityForSave(form);
        refreshFilenameTemplateValidity(form);
        refreshMetadataFieldValidity(form);
        if (!form.reportValidity()) {
          status.textContent = "Config has invalid fields.";
          return;
        }
        if (!(await validateExperimentDataFilePaths(form, options))) {
          status.textContent = "Config has invalid experiment file paths.";
          return;
        }
        if (!(await validateStimulusImagePaths(form, options))) {
          status.textContent = "Config has invalid image paths.";
          return;
        }
        const config = configFromEditorForm(form);
        const saved = await options.onSave(configToJsonText(config));
        if (saved) {
          document.title = config.experimentName;
          heading.textContent = config.experimentName;
          status.textContent = "Config saved.";
          options.onSaved?.();
          return;
        }
        status.textContent = "Config save cancelled.";
      } catch (error) {
        console.error(error);
        status.textContent =
          error instanceof Error ? error.message : "Config could not be saved.";
      }
    })();
  });
}
