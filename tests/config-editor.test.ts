import { describe, expect, it } from "vitest";
import { normaliseExperimentConfig as normaliseStrictExperimentConfig } from "../src/core/config";
import {
  configToJsonText,
  createDefaultEditorConfig,
  parseManualMetadataJson,
  serialiseExperimentConfig,
} from "../src/config-editor/config-editor-model";

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

describe("config editor model", () => {
  it("creates a default new-experiment config", () => {
    expect(createDefaultEditorConfig()).toEqual(
      normaliseExperimentConfig({
        experimentName: "OPJRD experiment",
      })
    );
  });

  it("serialises default metadata fields as expanded config objects", () => {
    const json = serialiseExperimentConfig(createDefaultEditorConfig());

    expect(json.participantMetadata).toMatchObject({
      fields: [
        { name: "participant_id", label: "ID", type: "text" },
        { name: "age", label: "Age", type: "number" },
        {
          name: "gender",
          label: "Gender",
          type: "radio",
          options: [
            "Woman/Female",
            "Man/Male",
            "Non-binary",
            { label: "Different term", freeText: true },
            "Prefer not to say",
          ],
        },
        {
          name: "condition",
          label: "Condition",
          type: "radio",
          options: ["Condition 1", "Condition 2"],
        },
      ],
    });
  });

  it("writes config JSON that can be loaded again", () => {
    const config = normaliseExperimentConfig({
      experimentName: "Phase 6 editor smoke test",
      taskMode: "jrd",
      response: {
        stimuli: {
          mode: "image",
          imageSizePx: 96,
          images: {
            A: "assets/object-a.svg",
          },
        },
      },
      participantMetadata: {
        provider: "form",
        fields: [
          { name: "participant_id", label: "ID", type: "text" },
          {
            name: "group",
            label: "Group",
            type: "select",
            options: ["Group A", "Group B"],
          },
        ],
      },
    });
    const savedJson = JSON.parse(configToJsonText(config));

    expect(normaliseExperimentConfig(savedJson)).toEqual(config);
  });

  it("serialises the space-bar finalisation key as a readable config value", () => {
    const config = normaliseExperimentConfig({
      taskMode: "object_placement",
      response: {
        objectPlacement: {
          finalisationKey: "space",
        },
      },
    });
    const json = serialiseExperimentConfig(config);

    expect(json.response).toMatchObject({
      objectPlacement: {
        finalisationKey: "space",
      },
    });
    expect(configToJsonText(config)).toContain('"finalisationKey": "space"');
  });

  it("serialises the layout radius with the canonical config key", () => {
    const config = normaliseExperimentConfig({
      response: {
        layoutRadius: 7,
      },
    });
    const json = serialiseExperimentConfig(config);

    expect(json.response).toMatchObject({
      layoutRadius: 7,
    });
    expect(json.response).not.toHaveProperty("responseAreaRadius");
    expect(json.response).not.toHaveProperty("responseCircleRadius");
  });

  it("serialises stimulus rendering settings", () => {
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "image",
          imageSizePx: 88,
          images: {
            A: "assets/object-a.svg",
          },
        },
      },
    });
    const json = serialiseExperimentConfig(config);

    expect(json.response).toMatchObject({
      stimuli: {
        mode: "image",
        imageSizePx: 88,
        images: {
          A: "assets/object-a.svg",
        },
      },
    });
  });

  it("omits object-placement-specific settings from JRD config output", () => {
    const config = normaliseExperimentConfig({
      taskMode: "jrd",
    });
    const json = serialiseExperimentConfig(config);

    expect(json.response).not.toHaveProperty("objectPlacement");
  });

  it("accepts only flat primitive manual metadata values", () => {
    expect(parseManualMetadataJson('{"participant_id":"P001","age":22}')).toEqual({
      participant_id: "P001",
      age: 22,
    });
    expect(() => parseManualMetadataJson('{"nested":{"id":"P001"}}')).toThrow(
      /Manual participant metadata/u
    );
  });

});
