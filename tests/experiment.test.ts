import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import { parseCsv } from "../src/core/csv";
import {
  buildExperimentModel,
  parseLocations,
  parseTrials,
} from "../src/core/experiment";

const fixturePath = (...parts: string[]) =>
  join(process.cwd(), "tests", "fixtures", ...parts);

const REQUIRED_INPUT_FILES = {
  locationsFile: "locations.csv",
  trialsFile: "trials.csv",
};

function normaliseExperimentConfig(
  raw: Record<string, unknown> = {}
) {
  return normaliseStrictExperimentConfig({
    ...REQUIRED_INPUT_FILES,
    ...raw,
  });
}

function readFixtureCsv(filename: string) {
  return parseCsv(readFileSync(fixturePath(filename), "utf8"));
}

describe("CSV parsing", () => {
  it("parses quoted fields with commas", () => {
    const rows = parseCsv('location,x,y\n"Door, north",1,2\n');

    expect(rows).toEqual([{ location: "Door, north", x: "1", y: "2" }]);
  });

  it("rejects duplicate location names", () => {
    expect(() =>
      parseLocations(
        parseCsv("location,x,y\nA,0,0\nA,1,1\n")
      )
    ).toThrow(/duplicate location/u);
  });

  it("rejects duplicate trial IDs", () => {
    expect(() =>
      parseTrials(
        parseCsv("trial_id,location,direction,target\n1,A,B,C\n1,A,C,B\n")
      )
    ).toThrow(/duplicate trial_id/u);
  });
});

describe("experiment model fixtures", () => {
  it("loads the edge-case fixture experiment", () => {
    const config = normaliseExperimentConfig({
      zeroDirection: { x: 0, y: 1 },
      response: {
        abDistance: 4,
      },
    });
    const model = buildExperimentModel(
      config,
      readFixtureCsv("edge-locations.csv"),
      readFixtureCsv("edge-trials.csv")
    );

    expect(model.trials).toHaveLength(3);
    expect(model.trials[0]?.imaginedHeadingDeg).toBeCloseTo(180, 8);
    expect(model.trials[1]?.trueDistance).toBeGreaterThan(1000);
  });

  it("rejects trials that reference missing locations", () => {
    const config = normaliseExperimentConfig({});

    expect(() =>
      buildExperimentModel(
        config,
        parseCsv("location,x,y\nA,0,0\nB,0,1\n"),
        parseCsv("trial_id,location,direction,target\n1,A,B,C\n")
      )
    ).toThrow(/Missing location reference/u);
  });

  it("loads locations and trials through an experiment file loader", async () => {
    const config = normaliseExperimentConfig({});
    const requestedPaths: string[] = [];
    const model = await import("../src/core/experiment").then(({ loadExperimentModel }) =>
      loadExperimentModel(config, {
        loadAssetUrl: async (path: string) => `asset:${path}`,
        loadTextFile: async (path: string) => {
          requestedPaths.push(path);
          if (path === "locations.csv") {
            return "location,x,y\nA,0,0\nB,0,1\nC,1,1\n";
          }
          if (path === "trials.csv") {
            return "trial_id,location,direction,target\n1,A,B,C\n";
          }
          throw new Error(path);
        },
      })
    );

    expect(requestedPaths.sort()).toEqual(["locations.csv", "trials.csv"]);
    expect(model.trials).toHaveLength(1);
  });
});
