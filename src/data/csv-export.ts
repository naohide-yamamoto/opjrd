import type { ParticipantMetadataValue } from "../core/types";
import type { SessionEnvelope } from "./session";

type CsvValue = unknown;
type CsvRow = Record<string, CsvValue>;

function escapeCsvCell(value: CsvValue): string {
  if (value === undefined || value === null) {
    return "";
  }

  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return /[",\r\n]/u.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function makeParticipantColumns(
  participantValues: Record<string, ParticipantMetadataValue>,
  rowColumns: Set<string>
): CsvRow {
  return Object.fromEntries(
    Object.entries(participantValues).map(([key, value]) => [
      rowColumns.has(key) ? `participant_${key}` : key,
      value,
    ])
  );
}

export function flattenSessionRowsForCsv(session: SessionEnvelope): CsvRow[] {
  const rowColumns = new Set(session.rows.flatMap((row) => Object.keys(row)));
  const participantColumns = makeParticipantColumns(
    session.participant_metadata.values,
    rowColumns
  );

  return session.rows.map((row) => ({
    ...participantColumns,
    ...row,
  }));
}

export function sessionToWideCsv(session: SessionEnvelope): string {
  const rows = flattenSessionRowsForCsv(session);
  const columns = Array.from(
    rows.reduce<Set<string>>((columnSet, row) => {
      Object.keys(row).forEach((key) => columnSet.add(key));
      return columnSet;
    }, new Set())
  );

  if (columns.length === 0) {
    return "";
  }

  return [
    columns.map(escapeCsvCell).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(",")),
  ].join("\r\n");
}
