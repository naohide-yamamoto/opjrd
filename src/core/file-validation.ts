export const SUPPORTED_EXPERIMENT_DATA_FILE_EXTENSION = ".csv";

export const SUPPORTED_STIMULUS_IMAGE_EXTENSIONS = [
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
] as const;

export const SUPPORTED_STIMULUS_IMAGE_FORMATS =
  ".svg, .png, .jpg, .jpeg, .webp, .gif, or .bmp";

export function hasSupportedExperimentDataFileExtension(path: string): boolean {
  return path.trim().toLowerCase().endsWith(SUPPORTED_EXPERIMENT_DATA_FILE_EXTENSION);
}

export function hasSupportedStimulusImageExtension(path: string): boolean {
  const lowerPath = path.trim().toLowerCase();

  return SUPPORTED_STIMULUS_IMAGE_EXTENSIONS.some((extension) =>
    lowerPath.endsWith(extension)
  );
}

export function unsupportedExperimentDataFileFormatMessage(
  label: string,
  path: string
): string {
  return `Config error: Unsupported ${label} file format: ${path}.`;
}

export function unsupportedStimulusImageFormatMessage(
  objectName: string,
  path: string
): string {
  return `Config error: Unsupported stimulus image file format for object ${objectName}: ${path}.`;
}
