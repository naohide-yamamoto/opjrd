export const SUPPORTED_FILENAME_TEMPLATE_TOKENS = [
  "experimentName",
  "participant_id",
  "condition",
  "group",
  "timestamp",
  "timestamp_local",
  "timestamp_iso",
  "session_id",
  "session_id_full",
  "task_mode",
] as const;

const FILENAME_TEMPLATE_TOKEN_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/gu;

export function unsupportedFilenameTemplateTokens(template: string): string[] {
  const supported = new Set<string>(SUPPORTED_FILENAME_TEMPLATE_TOKENS);
  return [
    ...new Set(
      [...template.matchAll(FILENAME_TEMPLATE_TOKEN_PATTERN)]
        .map((match) => match[1] ?? "")
        .filter((token) => token && !supported.has(token))
    ),
  ];
}

export function filenameTemplateUnsupportedTokenMessage(
  template: string
): string {
  const unsupportedTokens = unsupportedFilenameTemplateTokens(template);
  if (unsupportedTokens.length === 0) {
    return "";
  }

  const tokens = unsupportedTokens.map((token) => `{${token}}`).join(", ");
  return unsupportedTokens.length === 1
    ? `Config error: Filename template contains unsupported token ${tokens}.`
    : `Config error: Filename template contains unsupported tokens ${tokens}.`;
}

export function assertSupportedFilenameTemplateTokens(template: string): void {
  const message = filenameTemplateUnsupportedTokenMessage(template);
  if (message) {
    throw new Error(message);
  }
}
