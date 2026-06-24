import { parseCsv, type CsvRow } from "./csv";
import { buildTrialGeometry } from "./geometry";
import type {
  ExperimentConfig,
  LocationIndex,
  LocationRecord,
  TrialGeometry,
  TrialReference,
} from "./types";

export interface ExperimentModel {
  config: ExperimentConfig;
  locations: LocationIndex;
  trials: TrialGeometry[];
}

export interface ExperimentFileLoader {
  loadTextFile: (path: string) => Promise<string>;
  loadAssetUrl: (path: string) => Promise<string>;
}

export function resolveRelativeUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

function parseFiniteNumber(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV error: ${fieldName} must be a finite number.`);
  }
  return parsed;
}

export function parseLocations(rows: CsvRow[]): LocationRecord[] {
  if (rows.length === 0) {
    throw new Error("CSV error: locations file must contain at least one row.");
  }

  const seen = new Set<string>();

  return rows.map((row, index) => {
    const name = String(row.location ?? row.name ?? "").trim();
    if (name.length === 0) {
      throw new Error(`CSV error: locations row ${index + 2} is missing location.`);
    }
    if (seen.has(name)) {
      throw new Error(`CSV error: duplicate location name '${name}'.`);
    }
    seen.add(name);

    return {
      name,
      x: parseFiniteNumber(row.x ?? "", `locations row ${index + 2} x`),
      y: parseFiniteNumber(row.y ?? "", `locations row ${index + 2} y`),
    };
  });
}

export function indexLocations(locations: LocationRecord[]): LocationIndex {
  return Object.fromEntries(
    locations.map((location) => [
      location.name,
      {
        x: location.x,
        y: location.y,
      },
    ])
  );
}

export function parseTrials(rows: CsvRow[]): TrialReference[] {
  if (rows.length === 0) {
    throw new Error("CSV error: trials file must contain at least one row.");
  }

  const seen = new Set<string>();

  return rows.map((row, index) => {
    const trialId = String(row.trial_id ?? row.trialId ?? index + 1).trim();
    const location = String(row.location ?? "").trim();
    const direction = String(row.direction ?? "").trim();
    const target = String(row.target ?? "").trim();

    if (trialId.length === 0) {
      throw new Error(`CSV error: trials row ${index + 2} is missing trial_id.`);
    }
    if (seen.has(trialId)) {
      throw new Error(`CSV error: duplicate trial_id '${trialId}'.`);
    }
    seen.add(trialId);

    if (!location || !direction || !target) {
      throw new Error(
        `CSV error: trials row ${index + 2} must contain location, direction, and target.`
      );
    }

    return {
      trialId,
      location,
      direction,
      target,
    };
  });
}

export function buildExperimentModel(
  config: ExperimentConfig,
  locationRows: CsvRow[],
  trialRows: CsvRow[]
): ExperimentModel {
  const locations = indexLocations(parseLocations(locationRows));
  const trials = parseTrials(trialRows).map((trial) =>
    buildTrialGeometry(
      trial,
      locations,
      config.zeroDirection,
      config.response.abDistance
    )
  );

  return {
    config,
    locations,
    trials: config.randomiseTrials ? shuffle(trials) : trials,
  };
}

export async function loadExperimentModel(
  config: ExperimentConfig,
  fileLoaderOrConfigUrl: ExperimentFileLoader | string
): Promise<ExperimentModel> {
  const fileLoader =
    typeof fileLoaderOrConfigUrl === "string"
      ? createBrowserExperimentFileLoader(fileLoaderOrConfigUrl)
      : fileLoaderOrConfigUrl;
  const [locationsText, trialsText] = await Promise.all([
    loadRequiredExperimentText(fileLoader, config.locationsFile, "locations"),
    loadRequiredExperimentText(fileLoader, config.trialsFile, "trials"),
  ]);

  return buildExperimentModel(
    config,
    parseCsv(locationsText),
    parseCsv(trialsText)
  );
}

export function createBrowserExperimentFileLoader(
  configUrl: string
): ExperimentFileLoader {
  return {
    loadAssetUrl: async (path: string) => resolveRelativeUrl(path, configUrl),
    loadTextFile: async (path: string) => {
      const url = resolveRelativeUrl(path, configUrl);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
      return response.text();
    },
  };
}

async function loadRequiredExperimentText(
  fileLoader: ExperimentFileLoader,
  path: string,
  label: string
): Promise<string> {
  try {
    return await fileLoader.loadTextFile(path);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Could not load ${label} file: ${path}.${detail}`);
  }
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
