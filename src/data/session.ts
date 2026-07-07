import type {
  ExperimentConfig,
  ParticipantMetadataProvider,
  ParticipantMetadataValue,
} from "../core/types";
import { isJatosRuntimeAvailable } from "../runtime/jatos";

export interface RuntimeMetadata {
  runtime_environment: "browser" | "jatos" | "tauri";
  operating_system_name: string | null;
  operating_system_version: string | null;
  operating_system_version_source: "user_agent" | "user_agent_data" | null;
  browser_name: string | null;
  browser_version: string | null;
  browser_version_source: "user_agent" | "user_agent_data" | null;
  browser_engine: string | null;
  webview_or_browser_version: string | null;
  user_agent: string;
  platform: string;
  architecture: string | null;
  architecture_source: "user_agent_data" | null;
  bitness: string | null;
  user_agent_data_platform: string | null;
  user_agent_data_platform_version: string | null;
  user_agent_data_mobile: boolean | null;
  browser_language: string;
}

export interface ParticipantMetadataBlock {
  provider: ParticipantMetadataProvider;
  values: Record<string, ParticipantMetadataValue>;
}

export interface SessionEnvelope {
  session_id: string;
  app_name: string;
  app_version: string;
  experiment_name: string;
  task_mode: string;
  locale: string;
  timestamp_iso: string;
  timestamp_local: string;
  config_path: string;
  config_hash: string;
  zero_direction: {
    x: number;
    y: number;
  };
  runtime: RuntimeMetadata;
  participant_metadata: ParticipantMetadataBlock;
  rows: Record<string, unknown>[];
}

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

interface UserAgentBrandVersion {
  brand: string;
  version: string;
}

interface UserAgentDataValues {
  architecture?: string;
  bitness?: string;
  brands?: UserAgentBrandVersion[];
  fullVersionList?: UserAgentBrandVersion[];
  mobile?: boolean;
  model?: string;
  platform?: string;
  platformVersion?: string;
  uaFullVersion?: string;
}

interface UserAgentDataLike {
  brands?: UserAgentBrandVersion[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (
    hints: string[]
  ) => Promise<UserAgentDataValues>;
}

export interface RuntimeNavigatorLike {
  language?: string;
  platform?: string;
  userAgent?: string;
  userAgentData?: UserAgentDataLike;
}

export function detectRuntimeEnvironment(): RuntimeMetadata["runtime_environment"] {
  if (isJatosRuntimeAvailable()) {
    return "jatos";
  }
  if (typeof window !== "undefined" && window.__TAURI__) {
    return "tauri";
  }
  return "browser";
}

function safeNavigator(): RuntimeNavigatorLike | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as RuntimeNavigatorLike);
}

function normaliseVersion(value: string | undefined): string | null {
  return value ? value.replaceAll("_", ".") : null;
}

function operatingSystemVersionFromUserAgent(value: string | undefined) {
  const operatingSystemVersion = normaliseVersion(value);

  return {
    operating_system_version: operatingSystemVersion,
    operating_system_version_source: operatingSystemVersion
      ? ("user_agent" as const)
      : null,
  };
}

function parseOperatingSystem(userAgent: string, platform: string) {
  if (/Windows NT/u.test(userAgent)) {
    return {
      operating_system_name: "Windows",
      ...operatingSystemVersionFromUserAgent(
        userAgent.match(/Windows NT ([0-9.]+)/u)?.[1]
      ),
    };
  }
  if (/Mac OS X/u.test(userAgent)) {
    return {
      operating_system_name: "macOS",
      ...operatingSystemVersionFromUserAgent(
        userAgent.match(/Mac OS X ([0-9_]+)/u)?.[1]
      ),
    };
  }
  if (/Android/u.test(userAgent)) {
    return {
      operating_system_name: "Android",
      ...operatingSystemVersionFromUserAgent(
        userAgent.match(/Android ([0-9.]+)/u)?.[1]
      ),
    };
  }
  if (/\b(iPhone|iPad|iPod)\b/u.test(userAgent)) {
    return {
      operating_system_name: "iOS",
      ...operatingSystemVersionFromUserAgent(
        userAgent.match(/OS ([0-9_]+)/u)?.[1]
      ),
    };
  }
  if (/Linux/u.test(platform) || /Linux/u.test(userAgent)) {
    return {
      operating_system_name: "Linux",
      operating_system_version: null,
      operating_system_version_source: null,
    };
  }

  return {
    operating_system_name: null,
    operating_system_version: null,
    operating_system_version_source: null,
  };
}

function parseBrowser(userAgent: string) {
  const edge = userAgent.match(/Edg\/([0-9.]+)/u);
  if (edge) {
    return {
      browser_name: "Edge",
      browser_version: edge[1],
      browser_version_source: "user_agent" as const,
      browser_engine: "Blink",
    };
  }

  const firefox = userAgent.match(/Firefox\/([0-9.]+)/u);
  if (firefox) {
    return {
      browser_name: "Firefox",
      browser_version: firefox[1],
      browser_version_source: "user_agent" as const,
      browser_engine: "Gecko",
    };
  }

  const chrome = userAgent.match(/Chrome\/([0-9.]+)/u);
  if (chrome) {
    return {
      browser_name: "Chrome",
      browser_version: chrome[1],
      browser_version_source: "user_agent" as const,
      browser_engine: "Blink",
    };
  }

  const safari = userAgent.match(/Version\/([0-9.]+).*Safari/u);
  if (safari) {
    return {
      browser_name: "Safari",
      browser_version: safari[1],
      browser_version_source: "user_agent" as const,
      browser_engine: "WebKit",
    };
  }

  return {
    browser_name: null,
    browser_version: null,
    browser_version_source: null,
    browser_engine: null,
  };
}

function normaliseUserAgentDataPlatform(platform: string | undefined): string | null {
  if (!platform) {
    return null;
  }

  if (platform === "macOS") {
    return "macOS";
  }
  if (platform === "Windows") {
    return "Windows";
  }
  if (platform === "Android") {
    return "Android";
  }
  if (platform === "Linux") {
    return "Linux";
  }
  if (platform === "Chrome OS") {
    return "Chrome OS";
  }

  return platform;
}

async function readUserAgentData(
  nav: RuntimeNavigatorLike | undefined
): Promise<UserAgentDataValues> {
  const userAgentData = nav?.userAgentData;
  if (!userAgentData) {
    return {};
  }

  const lowEntropyValues: UserAgentDataValues = {
    brands: userAgentData.brands,
    mobile: userAgentData.mobile,
    platform: userAgentData.platform,
  };

  if (!userAgentData.getHighEntropyValues) {
    return lowEntropyValues;
  }

  try {
    const highEntropyValues = await userAgentData.getHighEntropyValues([
      "architecture",
      "bitness",
      "brands",
      "fullVersionList",
      "mobile",
      "model",
      "platform",
      "platformVersion",
      "uaFullVersion",
    ]);

    return {
      ...lowEntropyValues,
      ...highEntropyValues,
    };
  } catch {
    return lowEntropyValues;
  }
}

function findBrandVersion(
  brands: UserAgentBrandVersion[] | undefined,
  pattern: RegExp
): string | null {
  return brands?.find((brand) => pattern.test(brand.brand))?.version ?? null;
}

function browserVersionFromUserAgentData(
  browserName: string | null,
  values: UserAgentDataValues
): string | null {
  const fullVersionList = values.fullVersionList;

  if (browserName === "Edge") {
    return findBrandVersion(fullVersionList, /Microsoft Edge|Edge/u);
  }

  if (browserName === "Chrome") {
    return (
      findBrandVersion(fullVersionList, /Google Chrome/u) ??
      findBrandVersion(fullVersionList, /Chromium/u) ??
      values.uaFullVersion ??
      null
    );
  }

  return values.uaFullVersion ?? null;
}

export async function collectRuntimeMetadata(
  nav: RuntimeNavigatorLike | undefined = safeNavigator()
): Promise<RuntimeMetadata> {
  const userAgent = nav?.userAgent ?? "";
  const platform = nav?.platform ?? "";
  const userAgentData = await readUserAgentData(nav);
  const operatingSystem = parseOperatingSystem(userAgent, platform);
  const browser = parseBrowser(userAgent);
  const highEntropyBrowserVersion = browserVersionFromUserAgentData(
    browser.browser_name,
    userAgentData
  );
  const browserVersion = highEntropyBrowserVersion ?? browser.browser_version;
  const highEntropyOperatingSystemVersion = normaliseVersion(
    userAgentData.platformVersion
  );
  const operatingSystemVersion =
    highEntropyOperatingSystemVersion ?? operatingSystem.operating_system_version;

  return {
    runtime_environment: detectRuntimeEnvironment(),
    operating_system_name:
      normaliseUserAgentDataPlatform(userAgentData.platform) ??
      operatingSystem.operating_system_name,
    operating_system_version: operatingSystemVersion,
    operating_system_version_source: highEntropyOperatingSystemVersion
      ? "user_agent_data"
      : operatingSystem.operating_system_version_source,
    browser_name: browser.browser_name,
    browser_version: browserVersion,
    browser_version_source: highEntropyBrowserVersion
      ? "user_agent_data"
      : browser.browser_version_source,
    browser_engine: browser.browser_engine,
    webview_or_browser_version: browserVersion,
    user_agent: userAgent,
    platform,
    architecture: userAgentData.architecture ?? null,
    architecture_source: userAgentData.architecture ? "user_agent_data" : null,
    bitness: userAgentData.bitness ?? null,
    user_agent_data_platform: userAgentData.platform ?? null,
    user_agent_data_platform_version: userAgentData.platformVersion ?? null,
    user_agent_data_mobile: userAgentData.mobile ?? null,
    browser_language: nav?.language ?? "",
  };
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function padNumber(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function formatLocalTimestamp(date: Date): string {
  const timezoneOffsetMinutes = -date.getTimezoneOffset();
  const timezoneSign = timezoneOffsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(timezoneOffsetMinutes);
  const timezoneHours = Math.floor(absoluteOffsetMinutes / 60);
  const timezoneMinutes = absoluteOffsetMinutes % 60;

  return [
    `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`,
    `T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`,
    `.${padNumber(date.getMilliseconds(), 3)}`,
    `${timezoneSign}${padNumber(timezoneHours)}:${padNumber(timezoneMinutes)}`,
  ].join("");
}

export function formatFilenameLocalTimestamp(date: Date): string {
  return [
    `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}`,
    `${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(date.getSeconds())}`,
  ].join("-");
}

export async function buildSessionEnvelope(
  config: ExperimentConfig,
  configPath: string,
  configHash: string,
  rows: Record<string, unknown>[],
  participantMetadata: ParticipantMetadataBlock = {
    provider: config.participantMetadata.provider,
    values: {},
  }
): Promise<SessionEnvelope> {
  const timestamp = new Date();

  return {
    session_id: createSessionId(),
    app_name: config.appName,
    app_version: "0.2.0",
    experiment_name: config.experimentName,
    task_mode: config.taskMode,
    locale: config.locale,
    timestamp_iso: timestamp.toISOString(),
    timestamp_local: formatLocalTimestamp(timestamp),
    config_path: configPath,
    config_hash: configHash,
    zero_direction: config.zeroDirection,
    runtime: await collectRuntimeMetadata(),
    participant_metadata: participantMetadata,
    rows,
  };
}
