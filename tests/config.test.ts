import { describe, expect, it } from "vitest";
import {
  createEditableConfigDraft,
  normaliseExperimentConfig as normaliseStrictExperimentConfig,
} from "../src/core/config";

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

describe("config model", () => {
  it("defaults to object-placement mode", () => {
    const config = normaliseExperimentConfig({});

    expect(config.taskMode).toBe("object_placement");
    expect(config.response.layoutRadius).toBe(6);
    expect(config.timing.latencyStartEvent).toBe("a_onset");
    expect(config.timing.firstTrialStartDelayMsec).toBe(1000);
    expect(config.response.trialStartGate).toEqual({
      enabled: true,
      label: "Start",
      position: { x: 0, y: 0 },
      widthPx: null,
      heightPx: null,
      warningEnabled: true,
      warningDelayMsec: 5000,
      warningMessage:
        "Please click the {label} button to begin a trial.",
    });
    expect(config.response.feedback).toEqual({
      colour: "#0b5fff",
      durationMsec: 1000,
    });
    expect(config.response.canvas).toEqual({
      objectPlacement: {
        shape: "circle",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
      jrd: {
        shape: "square",
        sizePx: 760,
        widthPx: 760,
        heightPx: 760,
        visible: true,
      },
    });
    expect(config.response.text).toEqual({
      objectLabels: {
        colour: "#101828",
        sizePx: 48,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabels: {
        colour: "#475467",
        sizePx: 28,
        fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      },
      supportLabelOffsets: {
        at: { x: 0, y: 1 },
        facing: { x: 0, y: 1 },
        place: { x: 0, y: 0.85 },
        pointTo: { x: 0, y: 1 },
      },
    });
    expect(config.response.objectPlacement.requireMoveBeforeFinalise).toBe(true);
    expect(config.response.objectPlacement.moveRequiredWarningMessage).toBe(
      "Move the target object before pressing the {finalisationKey}."
    );
    expect(config.response.objectPlacement.cInitialPosition).toEqual({
      x: 0,
      y: 4.75,
    });
    expect(config.save.destination).toBe("local");
    expect(config.save.csvEnabled).toBe(false);
    expect(config.save.filenameTemplate).toBe(
      "{experimentName}_{participant_id}_{session_id}"
    );
    expect(config.participantMetadata.provider).toBe("none");
    expect(config.participantMetadata.fields).toEqual([
      { name: "participant_id", label: "ID", type: "text", options: [] },
      { name: "age", label: "Age", type: "number", options: [] },
      {
        name: "gender",
        label: "Gender",
        type: "radio",
        options: [
          { label: "Woman/Female", freeText: false },
          { label: "Man/Male", freeText: false },
          { label: "Non-binary", freeText: false },
          { label: "Different term", freeText: true },
          { label: "Prefer not to say", freeText: false },
        ],
      },
      {
        name: "condition",
        label: "Condition",
        type: "radio",
        options: [
          { label: "Condition 1", freeText: false },
          { label: "Condition 2", freeText: false },
        ],
      },
    ]);
    expect(config.participantMetadata.manualValues).toEqual({});
    expect(config.participantMetadata.urlParameters).toEqual([]);
  });

  it("accepts JRD mode", () => {
    const config = normaliseExperimentConfig({ taskMode: "jrd" });

    expect(config.taskMode).toBe("jrd");
  });

  it("rejects invalid task modes", () => {
    expect(() => normaliseExperimentConfig({ taskMode: "placement" })).toThrow(
      /taskMode/u
    );
  });

  it("requires input-file paths", () => {
    expect(() =>
      normaliseStrictExperimentConfig({ trialsFile: "trials.csv" })
    ).toThrow(/Config error: locationsFile must be specified\./u);

    expect(() =>
      normaliseStrictExperimentConfig({ locationsFile: "locations.csv" })
    ).toThrow(/Config error: trialsFile must be specified\./u);
  });

  it("rejects explicit empty input-file paths", () => {
    expect(() =>
      normaliseExperimentConfig({ locationsFile: "   " })
    ).toThrow(/locationsFile/u);

    expect(() => normaliseExperimentConfig({ trialsFile: "" })).toThrow(
      /trialsFile/u
    );
  });

  it("rejects unsupported input-file extensions", () => {
    expect(() =>
      normaliseExperimentConfig({ locationsFile: "locations.tsv" })
    ).toThrow(
      /Config error: Unsupported locations file format: locations\.tsv\./u
    );

    expect(() =>
      normaliseExperimentConfig({ trialsFile: "trials.txt" })
    ).toThrow(
      /Config error: Unsupported trials file format: trials\.txt\./u
    );
  });

  it("creates an editable draft for recoverable field-level errors", () => {
    const config = createEditableConfigDraft({
      locationsFile: "",
      trialsFile: "trials.ods",
      zeroDirection: { x: 0, y: 0 },
      response: {
        abDistance: 0,
        layoutRadius: -1,
        feedback: {
          durationMsec: -100,
        },
        stimuli: {
          mode: "image",
          imageSizePx: 0,
          images: {
            C: "assets/object-c.tiff",
          },
        },
        objectPlacement: {
          finalisationKey: "",
        },
      },
      save: {
        filenameTemplate: "{experimentName}_{unsupported}_{session_id}",
      },
    });

    expect(config.locationsFile).toBe("");
    expect(config.trialsFile).toBe("trials.ods");
    expect(config.zeroDirection).toEqual({ x: 0, y: 0 });
    expect(config.response.abDistance).toBe(0);
    expect(config.response.layoutRadius).toBe(-1);
    expect(config.response.feedback.durationMsec).toBe(-100);
    expect(config.response.stimuli.imageSizePx).toBe(0);
    expect(config.response.stimuli.images.C).toBe("assets/object-c.tiff");
    expect(config.response.objectPlacement.finalisationKey).toBe("");
    expect(config.save.filenameTemplate).toBe(
      "{experimentName}_{unsupported}_{session_id}"
    );
  });

  it("rejects zero-length experimenter-defined zero directions", () => {
    expect(() =>
      normaliseExperimentConfig({ zeroDirection: { x: 0, y: 0 } })
    ).toThrow(
      /Config error: zeroDirection must not be a zero-length vector\./u
    );
  });

  it("rejects explicit blank zero-direction components", () => {
    expect(() =>
      normaliseExperimentConfig({ zeroDirection: { x: "", y: 1 } })
    ).toThrow(/zeroDirection\.x/u);

    expect(() =>
      normaliseExperimentConfig({ zeroDirection: { x: 0, y: null } })
    ).toThrow(/zeroDirection\.y/u);
  });

  it("allows object-placement movement-finalisation settings to be configured", () => {
    const config = normaliseExperimentConfig({
      response: {
        objectPlacement: {
          finalisationKey: "space",
          requireMoveBeforeFinalise: false,
          moveRequiredWarningMessage: "Please move the object first.",
        },
      },
    });

    expect(config.response.objectPlacement.finalisationKey).toBe(" ");
    expect(config.response.objectPlacement.requireMoveBeforeFinalise).toBe(false);
    expect(config.response.objectPlacement.moveRequiredWarningMessage).toBe(
      "Please move the object first."
    );
  });

  it("rejects explicit blank object-placement finalisation keys", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          objectPlacement: {
            finalisationKey: "",
          },
        },
      })
    ).toThrow(/finalisationKey/u);
  });

  it("normalises omitted JRD object-placement settings internally", () => {
    const config = normaliseExperimentConfig({
      taskMode: "jrd",
      response: {},
    });

    expect(config.response.objectPlacement).toMatchObject({
      finalisationKey: " ",
      requireMoveBeforeFinalise: true,
      moveRequiredWarningMessage:
        "Move the target object before pressing the {finalisationKey}.",
    });
  });

  it("allows the trial start gate to be configured", () => {
    const config = normaliseExperimentConfig({
      response: {
        trialStartGate: {
          enabled: false,
          label: "Begin",
          position: { x: 1, y: -1 },
          widthPx: 80,
          heightPx: 32,
          warningEnabled: false,
          warningDelayMsec: 2500,
          warningMessage: "Click {label}.",
        },
      },
    });

    expect(config.response.trialStartGate).toEqual({
      enabled: false,
      label: "Begin",
      position: { x: 1, y: -1 },
      widthPx: 80,
      heightPx: 32,
      warningEnabled: false,
      warningDelayMsec: 2500,
      warningMessage: "Click {label}.",
    });
  });

  it("allows response canvas display settings to be configured per mode", () => {
    const config = normaliseExperimentConfig({
      response: {
        canvas: {
          objectPlacement: {
            shape: "square",
            sizePx: 640,
            visible: false,
          },
          jrd: {
            shape: "rectangle",
            sizePx: 700,
            widthPx: 900,
            heightPx: 540,
            visible: true,
          },
        },
      },
    });

    expect(config.response.canvas.objectPlacement).toEqual({
      shape: "square",
      sizePx: 640,
      widthPx: 640,
      heightPx: 640,
      visible: false,
    });
    expect(config.response.canvas.jrd).toEqual({
      shape: "rectangle",
      sizePx: 700,
      widthPx: 900,
      heightPx: 540,
      visible: true,
    });
  });

  it("allows layout radius to be configured", () => {
    expect(
      normaliseExperimentConfig({
        response: {
          layoutRadius: 7,
        },
      }).response.layoutRadius
    ).toBe(7);
  });

  it("allows positive response interface distances below 1", () => {
    const config = normaliseExperimentConfig({
      response: {
        abDistance: 0.5,
        layoutRadius: 0.25,
      },
    });

    expect(config.response.abDistance).toBe(0.5);
    expect(config.response.layoutRadius).toBe(0.25);
  });

  it("rejects non-positive response interface distances", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          abDistance: 0,
        },
      })
    ).toThrow(/abDistance/u);

    expect(() =>
      normaliseExperimentConfig({
        response: {
          layoutRadius: 0,
        },
      })
    ).toThrow(/layoutRadius/u);
  });

  it("rejects invalid response canvas display settings", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          canvas: {
            jrd: {
              shape: "triangle",
            },
          },
        },
      })
    ).toThrow(/canvas shape/u);

    expect(() =>
      normaliseExperimentConfig({
        response: {
          canvas: {
            objectPlacement: {
              sizePx: 0,
            },
          },
        },
      })
    ).toThrow(/sizePx/u);

    expect(() =>
      normaliseExperimentConfig({
        response: {
          canvas: {
            objectPlacement: {
              shape: "rectangle",
              widthPx: 640,
              heightPx: -1,
            },
          },
        },
      })
    ).toThrow(/heightPx/u);
  });

  it("allows accepted-response feedback to be configured", () => {
    const config = normaliseExperimentConfig({
      response: {
        feedback: {
          colour: "#0057b8",
          durationMsec: 0,
        },
      },
    });

    expect(config.response.feedback).toEqual({
      colour: "#0057b8",
      durationMsec: 0,
    });
  });

  it("rejects negative accepted-response feedback durations", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          feedback: {
            durationMsec: -1,
          },
        },
      })
    ).toThrow(/durationMsec/u);
  });

  it("allows object and support label text settings to be configured", () => {
    const config = normaliseExperimentConfig({
      response: {
        text: {
          objectLabels: {
            colour: "#000000",
            sizePx: 56,
            fontFamily: "Arial, sans-serif",
          },
          supportLabels: {
            colour: "#777777",
            sizePx: 24,
            fontFamily: "Georgia, serif",
          },
          supportLabelOffsets: {
            at: { x: -1.25, y: 0 },
            facing: { x: 1.5, y: 0 },
            place: { x: 0, y: -1 },
            pointTo: { x: 0, y: -1.25 },
          },
        },
      },
    });

    expect(config.response.text.objectLabels).toEqual({
      colour: "#000000",
      sizePx: 56,
      fontFamily: "Arial, sans-serif",
    });
    expect(config.response.text.supportLabels).toEqual({
      colour: "#777777",
      sizePx: 24,
      fontFamily: "Georgia, serif",
    });
    expect(config.response.text.supportLabelOffsets).toEqual({
      at: { x: -1.25, y: 0 },
      facing: { x: 1.5, y: 0 },
      place: { x: 0, y: -1 },
      pointTo: { x: 0, y: -1.25 },
    });
  });

  it("allows stimulus image rendering settings to be configured", () => {
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "image",
          imageSizePx: 96,
          images: {
            A: "assets/object-a.svg",
            B: "assets/object-b.svg",
            C: "assets/object-c.svg",
          },
        },
      },
    });

    expect(config.response.stimuli).toEqual({
      mode: "image",
      imageSizePx: 96,
      images: {
        A: "assets/object-a.svg",
        B: "assets/object-b.svg",
        C: "assets/object-c.svg",
      },
    });
  });

  it("rejects invalid stimulus image settings", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          stimuli: {
            mode: "png",
          },
        },
      })
    ).toThrow(/response\.stimuli\.mode/u);

    expect(() =>
      normaliseExperimentConfig({
        response: {
          stimuli: {
            images: {
              A: "   ",
            },
          },
        },
      })
    ).toThrow(/response\.stimuli\.images\.A/u);

    expect(() =>
      normaliseExperimentConfig({
        response: {
          stimuli: {
            mode: "image",
            images: {
              C: "assets/object-c.tiff",
            },
          },
        },
      })
    ).toThrow(
      /Config error: Unsupported stimulus image file format for object C: assets\/object-c\.tiff\./u
    );
  });

  it("does not reject unused stimulus image extensions in text mode", () => {
    const config = normaliseExperimentConfig({
      response: {
        stimuli: {
          mode: "text",
          images: {
            C: "assets/object-c.tiff",
          },
        },
      },
    });

    expect(config.response.stimuli.images.C).toBe("assets/object-c.tiff");
  });

  it("rejects non-positive label font sizes", () => {
    expect(() =>
      normaliseExperimentConfig({
        response: {
          text: {
            objectLabels: {
              sizePx: 0,
            },
          },
        },
      })
    ).toThrow(/sizePx/u);
  });

  it("places C just above B by default when A-B distance changes", () => {
    const config = normaliseExperimentConfig({
      response: {
        abDistance: 6,
      },
    });

    expect(config.response.objectPlacement.cInitialPosition).toEqual({
      x: 0,
      y: 6.75,
    });
  });

  it("rejects invalid or removed save destination settings", () => {
    expect(() =>
      normaliseExperimentConfig({
        save: {
          destination: "download",
        },
      })
    ).toThrow(/save\.destination/u);

    expect(() =>
      normaliseExperimentConfig({
        save: {
          preferredAdapter: "download",
        },
      })
    ).toThrow(/save\.preferredAdapter/u);

    expect(() =>
      normaliseExperimentConfig({
        save: {
          filenameTemplate: "{experimentName}_{test}_{session_id}",
        },
      })
    ).toThrow(/Config error: Filename template contains unsupported token \{test\}\./u);
  });

  it("allows CSV export and participant metadata provider settings to be configured", () => {
    const config = normaliseExperimentConfig({
      save: {
        destination: "jatos",
        csvEnabled: true,
        filenameTemplate: "{participant_id}_{experimentName}",
      },
      participantMetadata: {
        provider: "jatos",
        fields: [
          { name: "participant_id", label: "ID", type: "text" },
          {
            name: "gender",
            label: "Gender",
            type: "radio",
            options: [
              "Female",
              { label: "Self-describe", freeText: true },
              "Prefer not to say",
            ],
          },
          {
            name: "condition",
            label: "Condition",
            type: "select",
            options: ["Control", "Experimental"],
          },
        ],
        manualValues: {
          participant_id: "P001",
          age: 21,
          pilot: true,
        },
        urlParameters: ["participant_id", "condition"],
      },
    });

    expect(config.save.csvEnabled).toBe(true);
    expect(config.save.destination).toBe("jatos");
    expect(config.save.filenameTemplate).toBe("{participant_id}_{experimentName}");
    expect(config.participantMetadata.provider).toBe("jatos");
    expect(config.participantMetadata.fields).toEqual([
      { name: "participant_id", label: "ID", type: "text", options: [] },
      {
        name: "gender",
        label: "Gender",
        type: "radio",
        options: [
          { label: "Female", freeText: false },
          { label: "Self-describe", freeText: true },
          { label: "Prefer not to say", freeText: false },
        ],
      },
      {
        name: "condition",
        label: "Condition",
        type: "select",
        options: [
          { label: "Control", freeText: false },
          { label: "Experimental", freeText: false },
        ],
      },
    ]);
    expect(config.participantMetadata.manualValues).toEqual({
      participant_id: "P001",
      age: 21,
      pilot: true,
    });
    expect(config.participantMetadata.urlParameters).toEqual([
      "participant_id",
      "condition",
    ]);
  });

  it("rejects invalid participant metadata providers", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          provider: "spreadsheet",
        },
      })
    ).toThrow(/participantMetadata\.provider/u);
  });

  it("rejects nested participant metadata manual values", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          manualValues: {
            nested: { id: "P001" },
          },
        },
      })
    ).toThrow(/manualValues\.nested/u);
  });

  it("rejects non-string participant metadata URL parameter names", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          urlParameters: ["participant_id", 42],
        },
      })
    ).toThrow(/urlParameters\[1\]/u);
  });

  it("rejects old string-only participant metadata fields", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: ["participant_id"],
        },
      })
    ).toThrow(/fields\[0\]/u);
  });

  it("rejects invalid participant metadata field settings", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [{ name: "", label: "ID", type: "text" }],
        },
      })
    ).toThrow(/fields\[0\]\.name/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [{ name: "group", label: "", type: "text" }],
        },
      })
    ).toThrow(/fields\[0\]\.label/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [{ name: "group", label: "Group", type: "checkbox" }],
        },
      })
    ).toThrow(/fields\[0\]\.type/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [
            { name: "group", label: "Group", type: "radio", options: [] },
          ],
        },
      })
    ).toThrow(/fields\[0\]\.options/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [
            {
              name: "notes",
              label: "Notes",
              type: "text",
              options: ["A"],
            },
          ],
        },
      })
    ).toThrow(/fields\[0\]\.options/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [
            {
              name: "score",
              label: "Score",
              type: "number",
              options: ["1"],
            },
          ],
        },
      })
    ).toThrow(/fields\[0\]\.options/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          fields: [
            {
              name: "group",
              label: "Group",
              type: "select",
              options: [{ label: "Other", freeText: true }],
            },
          ],
        },
      })
    ).toThrow(/free-text/u);
  });

  it("rejects removed participant metadata option keys", () => {
    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          genderOptions: [{ label: "Female" }],
        },
      })
    ).toThrow(/genderOptions/u);

    expect(() =>
      normaliseExperimentConfig({
        participantMetadata: {
          conditionOptions: ["Control"],
        },
      })
    ).toThrow(/conditionOptions/u);
  });
});
