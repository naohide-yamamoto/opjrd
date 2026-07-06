import type { ExperimentConfig } from "../core/types";
import { assertSupportedFilenameTemplateTokens } from "../core/filename-template";
import { getJatosRuntime } from "../runtime/jatos";
import { sessionToWideCsv } from "./csv-export";
import { formatFilenameLocalTimestamp, type SessionEnvelope } from "./session";
import { tauriSaveAdapter } from "./tauri-save-adapter";

const MULTI_FILE_DOWNLOAD_DELAY_MSEC = 250;
const OBJECT_URL_REVOKE_DELAY_MSEC = 30_000;

export interface SaveBundle {
  csv?: {
    filename: string;
    text: string;
  };
  json: {
    filename: string;
    session: SessionEnvelope;
  };
}

export interface SaveAdapter {
  name: string;
  isAvailable: () => boolean;
  save: (bundle: SaveBundle) => Promise<void>;
}

export class JatosSaveUnavailableError extends Error {
  constructor() {
    super("JATOS saving was requested, but the JATOS runtime is not available.");
    this.name = "JatosSaveUnavailableError";
  }
}

export class JatosResultFileUnavailableError extends Error {
  constructor() {
    super(
      "JATOS CSV export was requested, but JATOS result-file upload is not available."
    );
    this.name = "JatosResultFileUnavailableError";
  }
}

function safeFileStem(value: string): string {
  return (
    value.replaceAll(/[^\p{L}\p{N}_-]+/gu, "_").replaceAll(/^[_-]+|[_-]+$/gu, "") ||
    "opjrd"
  );
}

function participantIdForFilename(session: SessionEnvelope): string {
  const values = session.participant_metadata.values;
  const candidate = values.participant_id ?? values.participantId ?? values.pid;

  if (
    candidate === undefined ||
    candidate === null ||
    String(candidate).trim() === ""
  ) {
    return "no_participant_id";
  }

  return String(candidate);
}

function participantMetadataValueForFilename(
  session: SessionEnvelope,
  key: string,
  fallback: string
): string {
  const candidate = session.participant_metadata.values[key];
  if (
    candidate === undefined ||
    candidate === null ||
    String(candidate).trim() === ""
  ) {
    return fallback;
  }
  return String(candidate);
}

function shortSessionIdForFilename(session: SessionEnvelope): string {
  return session.session_id.replaceAll(/[^A-Za-z0-9]/gu, "").slice(0, 8);
}

function filenameTimestamp(session: SessionEnvelope): string {
  const localTimestampMatch = session.timestamp_local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/u
  );

  if (localTimestampMatch) {
    const [, year, month, day, hour, minute, second] = localTimestampMatch;
    return `${year}${month}${day}-${hour}${minute}${second}`;
  }

  return formatFilenameLocalTimestamp(new Date(session.timestamp_iso));
}

function renderFilenameTemplate(
  template: string,
  session: SessionEnvelope
): string {
  const values: Record<string, string> = {
    experimentName: session.experiment_name,
    participant_id: participantIdForFilename(session),
    condition: participantMetadataValueForFilename(
      session,
      "condition",
      "no_condition"
    ),
    group: participantMetadataValueForFilename(session, "group", "no_group"),
    timestamp: filenameTimestamp(session),
    timestamp_iso: session.timestamp_iso,
    timestamp_local: session.timestamp_local,
    session_id: shortSessionIdForFilename(session),
    session_id_full: session.session_id,
    task_mode: session.task_mode,
  };

  assertSupportedFilenameTemplateTokens(template);
  return template.replaceAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/gu, (match, key) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(
        `Config error: Filename template contains unsupported token ${match}.`
      );
    }
    return value;
  });
}

function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, OBJECT_URL_REVOKE_DELAY_MSEC);
}

function waitForNextDownloadSlot(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MULTI_FILE_DOWNLOAD_DELAY_MSEC);
  });
}

export function buildSaveBundle(
  config: ExperimentConfig,
  session: SessionEnvelope
): SaveBundle {
  const stem = safeFileStem(
    renderFilenameTemplate(config.save.filenameTemplate, session)
  );

  return {
    json: {
      filename: `${stem}.json`,
      session,
    },
    csv: config.save.csvEnabled
      ? {
          filename: `${stem}.csv`,
          text: sessionToWideCsv(session),
        }
      : undefined,
  };
}

export const downloadSaveAdapter: SaveAdapter = {
  name: "download",
  isAvailable: () => typeof document !== "undefined",
  save: async (bundle) => {
    downloadText(
      bundle.json.filename,
      JSON.stringify(bundle.json.session, null, 2),
      "application/json"
    );
    if (bundle.csv) {
      await waitForNextDownloadSlot();
      downloadText(bundle.csv.filename, bundle.csv.text, "text/csv");
    }
  },
};

export const jatosInternalSaveAdapter: SaveAdapter = {
  name: "jatos",
  isAvailable: () =>
    typeof getJatosRuntime()?.submitResultData === "function",
  save: async (bundle) => {
    const jatos = getJatosRuntime();
    if (typeof jatos?.submitResultData !== "function") {
      throw new JatosSaveUnavailableError();
    }
    if (bundle.csv && typeof jatos.uploadResultFile !== "function") {
      throw new JatosResultFileUnavailableError();
    }

    await jatos.submitResultData(bundle.json.session);

    if (typeof jatos.uploadResultFile === "function") {
      await jatos.uploadResultFile(
        JSON.stringify(bundle.json.session, null, 2),
        bundle.json.filename
      );
      if (bundle.csv) {
        await jatos.uploadResultFile(bundle.csv.text, bundle.csv.filename);
      }
    }

    const endStudy =
      jatos.endStudyWithoutRedirect ?? jatos.endStudyAjax;
    await endStudy?.(true, "OPJRD session saved.");
  },
};

export function selectSaveAdapter(config: ExperimentConfig): SaveAdapter {
  if (config.save.destination === "jatos") {
    if (jatosInternalSaveAdapter.isAvailable()) {
      return jatosInternalSaveAdapter;
    }
    throw new JatosSaveUnavailableError();
  }

  if (tauriSaveAdapter.isAvailable()) {
    return tauriSaveAdapter;
  }

  return downloadSaveAdapter;
}
