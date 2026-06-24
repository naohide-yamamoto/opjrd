import type { LocaleText } from "../i18n/locale";
import { TauriSaveCancelledError } from "./tauri-save-adapter";

export interface SaveFailureRecovery {
  shouldLogError: boolean;
  statusMessage: string;
}

export function saveFailureRecovery(
  error: unknown,
  localeText: LocaleText
): SaveFailureRecovery {
  if (error instanceof TauriSaveCancelledError) {
    return {
      shouldLogError: false,
      statusMessage: localeText.status.saveCancelled,
    };
  }

  return {
    shouldLogError: true,
    statusMessage: localeText.status.saveFailed,
  };
}
