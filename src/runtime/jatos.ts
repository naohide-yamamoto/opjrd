import type { ParticipantMetadataValue } from "../core/types";

export interface JatosRuntime {
  batchSessionData?: unknown;
  componentInput?: unknown;
  componentJsonInput?: unknown;
  studyInput?: unknown;
  studyJsonInput?: unknown;
  studySessionData?: unknown;
  urlQueryParameters?: unknown;
  onLoad?: (callback: () => void) => void;
  submitResultData?: (data: unknown) => Promise<unknown> | void;
  uploadResultFile?: (
    data: Blob | string | object,
    filename: string
  ) => Promise<unknown> | void;
  endStudyWithoutRedirect?: (
    successful?: boolean,
    message?: string
  ) => Promise<unknown> | void;
  endStudyAjax?: (
    successful?: boolean,
    message?: string
  ) => Promise<unknown> | void;
}

declare global {
  interface Window {
    jatos?: JatosRuntime;
  }
}

export function getJatosRuntime(): JatosRuntime | undefined {
  return typeof window === "undefined" ? undefined : window.jatos;
}

export function isJatosRuntimeAvailable(): boolean {
  return Boolean(getJatosRuntime());
}

export function waitForJatosOnLoad(): Promise<void> {
  const jatos = getJatosRuntime();
  if (typeof jatos?.onLoad !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    jatos.onLoad?.(resolve);
  });
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function keepPrimitiveMetadataValues(
  values: Record<string, unknown> | undefined
): Record<string, ParticipantMetadataValue> {
  if (!values) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, ParticipantMetadataValue] =>
        typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean" ||
        entry[1] === null
    )
  );
}

export function getJatosComponentInput(): Record<string, unknown> | undefined {
  const jatos = getJatosRuntime();
  return (
    asRecord(jatos?.componentInput) ?? asRecord(jatos?.componentJsonInput)
  );
}

export function getJatosStudyInput(): Record<string, unknown> | undefined {
  const jatos = getJatosRuntime();
  return asRecord(jatos?.studyInput) ?? asRecord(jatos?.studyJsonInput);
}

export function getJatosMetadataValues(): Record<string, ParticipantMetadataValue> {
  const jatos = getJatosRuntime();

  return {
    ...keepPrimitiveMetadataValues(asRecord(jatos?.studyInput)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.studyJsonInput)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.studySessionData)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.batchSessionData)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.urlQueryParameters)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.componentInput)),
    ...keepPrimitiveMetadataValues(asRecord(jatos?.componentJsonInput)),
  };
}
