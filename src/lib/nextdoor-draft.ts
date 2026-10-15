/**
 * Draft-only helper for Nextdoor recommendation replies.
 *
 * Nothing in this module connects to Nextdoor. Automated reading and posting
 * stay refused: the Member Agreement forbids scripts and robots that copy
 * data off the service, the Publish and Displaying APIs need an approved
 * application this project does not have, and a personal account may not
 * answer a recommendation by promoting its own business. Flagging risk is
 * not a switch that turns reading on.
 *
 * The permitted use is local: paste a post you already read, get one
 * Business Page draft, and decide yourself whether to publish it from
 * The Flip Fixer page Jon owns.
 */
import { createHash } from "node:crypto";
import { SERVICE_AREAS, SITE } from "./site.ts";

export const POLICY_REVIEWED_ON = "2026-10-15";

export const AUTOMATION_REFUSAL =
  "Whether a run would be flagged is not a reason to read the account. Automated Nextdoor reading and posting are off. No supported feed integration is configured. The Member Agreement forbids scripts, robots, crawlers, and other automated means of copying profiles or other data off the service. The Publish API and the Displaying Content APIs require an approved application; this project has no client id or access token, and the open Share Plugin only pre-fills a post a person submits by hand. The Displaying Search API, even after approval, returns public anyone-visibility posts from the last 30 days, not a logged-in neighborhood feed.";

export const PERSONAL_ACCOUNT_REFUSAL =
  "A personal account cannot answer this. Nextdoor's self-promotion policy (August 19, 2026) says paid-service promotion, including a reply to a recommendation request for your own business, has to come from the Business Page. Recommending another business from a personal account is limited to neighbors with no business relationship, referral benefit, or other conflict of interest. Jon owns The Flip Fixer Business Page. No personal-account draft was created, and nothing was posted.";

export const POLICY_SOURCES = [
  "https://blog.nextdoor.com/self-promotion-update",
  "https://nextdoorcrm.my.site.com/s/article/Self-Promotion-using-your-Personal-Account",
  "https://developer.nextdoor.com/reference/applying-for-access",
  "https://developer.nextdoor.com/docs/displaying-overview",
  "https://developer.nextdoor.com/docs/sharing-overview",
  "https://help.nextdoor.com/s/article/Member-Agreement-US-2026",
] as const;

export const SUGGESTED_DISCLOSURE =
  "I work with The Flip Fixer. Jon owns the Nextdoor Business Page. This reply is from that page, not from a personal neighbor account.";

export const STATE_FILENAME = "nextdoor-draft-state.json";

const MAX_POST_CHARS = 8_000;
const MAX_LOG = 400;
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 1_440;
const MIN_DAILY_CAP = 1;
const MAX_DAILY_CAP = 20;

export type ServiceId =
  "kitchen" | "bathroom" | "flooring" | "painting" | "make-ready" | "remodeling";

export type Channel = "business-page" | "personal";

export interface NextdoorDraftConfig {
  paused: boolean;
  stopped: boolean;
  stopReason: string | null;
  monitoringIntervalMinutes: number;
  maxDraftsPerDay: number;
  relationshipDisclosure: string;
  truthfulExperience: string | null;
}

export interface LogEntry {
  at: string;
  action: string;
  detail: string;
}

export interface HandledRecord {
  keys: string[];
  platformId: string | null;
  at: string;
  services: ServiceId[];
  area: string;
  draft: string;
}

export interface DraftState {
  version: 1;
  config: NextdoorDraftConfig;
  handled: HandledRecord[];
  log: LogEntry[];
}

export interface PostInput {
  text: string;
  channel: Channel;
  platformId?: string | null;
  neighborhood?: string | null;
}

export type IngestStatus =
  | "draft"
  | "paused"
  | "stopped"
  | "duplicate"
  | "not-a-request"
  | "outside-service-area"
  | "location-unknown"
  | "personal-account-blocked"
  | "limit"
  | "rejected"
  | "config-error";

export interface IngestResult {
  status: IngestStatus;
  services: ServiceId[];
  area: string | null;
  draft: string | null;
  posted: false;
  automationRunning: false;
  detail: string;
}

const SERVICE_RULES: Array<{ id: ServiceId; pattern: RegExp }> = [
  { id: "make-ready", pattern: /\bmake[-\s]?ready\b|\brental turnover\b|\bunit turnover\b/i },
  { id: "kitchen", pattern: /\bkitchens?\b/i },
  { id: "bathroom", pattern: /\bbathrooms?\b|\bbath remodel\b|\bmaster bath\b/i },
  {
    id: "flooring",
    pattern: /\bflooring\b|\bhardwood\b|\blaminate\b|\blvp\b|\bvinyl plank\b|\bfloors?\b/i,
  },
  { id: "painting", pattern: /\bpainters?\b|\bpainting\b|\bpaint job\b|\bpaint\b/i },
  { id: "remodeling", pattern: /\bremodels?\b|\bremodeling\b|\brenovat(?:e|ing|ion)\b/i },
];

const SERVICE_PHRASE: Record<ServiceId, string> = {
  kitchen: "a kitchen remodel",
  bathroom: "a bathroom remodel",
  flooring: "flooring",
  painting: "painting",
  "make-ready": "make-ready work",
  remodeling: "a remodel",
};

const REQUEST_PATTERN =
  /\b(?:looking for|in need of|need(?:s|ed)?(?:\s+\w+){0,2}\s+(?:a|an|someone|somebody|help)|want(?:s|ed)?\s+(?:a|an|the|someone|somebody)|anyone|anybody|any recommendations?|recommendations?|who (?:can|should|do you)|can anyone|does anyone|searching for|hiring|hire a|quote|estimate|suggestions? for|contractor)\b/i;

const NEGATED_REQUEST =
  /\b(?:not|never|nobody)\b(?:\s+\w+){0,6}\s+(?:looking|need|needed|recommend|recommended|hiring|quote|estimate)\b|\b(?:don't|dont|do not)\s+(?:need|want|recommend)\b/i;

const OFFERING_SERVICE =
  /\b(?:i am|i'm|we are|we're|my company is)\s+an?\s+(?:painter|contractor|remodeler|installer|handyman)\b/i;

const BROAD_REQUEST =
  /\b(?:looking for|in need of|hiring|hire a|contractor|who can|who should|can anyone|does anyone|need someone|need a|need an)\b/i;

const OUTSIDE_AREAS = [
  "New Braunfels",
  "San Marcos",
  "Corpus Christi",
  "Fort Worth",
  "El Paso",
  "Austin",
  "Dallas",
  "Houston",
  "Waco",
  "Lubbock",
  "Plano",
  "Arlington",
  "Laredo",
  "McAllen",
  "Midland",
  "Odessa",
  "Schertz",
  "Cibolo",
] as const;

const ZIP_AREAS: Array<{ name: string; pattern: RegExp }> = [
  { name: "San Antonio", pattern: /\b782\d{2}\b/ },
  { name: "Boerne", pattern: /\b78006\b/ },
  { name: "Fair Oaks Ranch", pattern: /\b78015\b/ },
  { name: "Helotes", pattern: /\b78023\b/ },
  { name: "Kerrville", pattern: /\b78028\b|\b78029\b/ },
];

export function initialState(partial: Partial<NextdoorDraftConfig> = {}): DraftState {
  return {
    version: 1,
    config: { ...defaultConfig(), ...partial },
    handled: [],
    log: [],
  };
}

export function defaultConfig(): NextdoorDraftConfig {
  return {
    paused: false,
    stopped: false,
    stopReason: null,
    monitoringIntervalMinutes: 60,
    maxDraftsPerDay: 5,
    relationshipDisclosure: SUGGESTED_DISCLOSURE,
    truthfulExperience: null,
  };
}

function disclosureIsValid(text: string): boolean {
  const value = text.toLowerCase();
  const namesTheBusiness = value.includes("flip fixer");
  const namesTheOwner = /\bjon\b/.test(value);
  const namesTheRelationship =
    value.includes("work with") ||
    value.includes("business") ||
    value.includes("owner") ||
    value.includes("employee") ||
    value.includes("financial");
  return namesTheBusiness && namesTheOwner && namesTheRelationship;
}

function stripControls(text: string): string {
  let cleaned = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    const visible = code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    cleaned += visible ? char : " ";
  }
  return cleaned;
}

function oneLine(text: string, max: number): string {
  const cleaned = stripControls(text).trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function withLog(state: DraftState, action: string, detail: string, now: Date): DraftState {
  const entry: LogEntry = {
    at: now.toISOString(),
    action,
    detail: oneLine(detail, 300),
  };
  return { ...state, log: [...state.log, entry].slice(-MAX_LOG) };
}

export function setPaused(state: DraftState, paused: boolean, now: Date): DraftState {
  return withLog(
    { ...state, config: { ...state.config, paused } },
    paused ? "paused" : "resumed",
    paused
      ? "Pause is on. New drafts are held until resume. Nothing is posted either way."
      : "Pause is off. Drafts can be created. Posting is still unavailable.",
    now,
  );
}

export function setMonitoringInterval(
  state: DraftState,
  minutes: number,
  now: Date,
): { state: DraftState; error: string | null } {
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_INTERVAL_MINUTES ||
    minutes > MAX_INTERVAL_MINUTES
  ) {
    return {
      state,
      error: `Interval must be a whole number of minutes from ${MIN_INTERVAL_MINUTES} to ${MAX_INTERVAL_MINUTES}.`,
    };
  }
  return {
    state: withLog(
      { ...state, config: { ...state.config, monitoringIntervalMinutes: minutes } },
      "interval-set",
      `Stored a ${minutes}-minute interval. No reader was scheduled, and no Nextdoor request was made.`,
      now,
    ),
    error: null,
  };
}

export function setMaxDraftsPerDay(
  state: DraftState,
  cap: number,
  now: Date,
): { state: DraftState; error: string | null } {
  if (!Number.isInteger(cap) || cap < MIN_DAILY_CAP || cap > MAX_DAILY_CAP) {
    return {
      state,
      error: `Daily draft cap must be a whole number from ${MIN_DAILY_CAP} to ${MAX_DAILY_CAP}.`,
    };
  }
  return {
    state: withLog(
      { ...state, config: { ...state.config, maxDraftsPerDay: cap } },
      "cap-set",
      `Local draft cap is ${cap} per UTC day. This is our cap, not a Nextdoor rate limit.`,
      now,
    ),
    error: null,
  };
}

export function setDisclosure(
  state: DraftState,
  disclosure: string,
  now: Date,
): { state: DraftState; error: string | null } {
  const text = disclosure.trim();
  if (!disclosureIsValid(text)) {
    return {
      state,
      error:
        "Disclosure has to name The Flip Fixer, Jon, and the business relationship. A reply is not created without that.",
    };
  }
  return {
    state: withLog(
      { ...state, config: { ...state.config, relationshipDisclosure: text } },
      "disclosure-set",
      "Relationship disclosure updated.",
      now,
    ),
    error: null,
  };
}

export function setTruthfulExperience(
  state: DraftState,
  experience: string | null,
  now: Date,
): { state: DraftState; error: string | null } {
  if (experience === null) {
    return {
      state: withLog(
        { ...state, config: { ...state.config, truthfulExperience: null } },
        "experience-cleared",
        "Truthful experience note cleared. Drafts will not describe hired work.",
        now,
      ),
      error: null,
    };
  }
  const text = oneLine(experience, 400);
  if (!text) {
    return { state, error: "Experience note is empty. Use experience --clear to remove it." };
  }
  return {
    state: withLog(
      { ...state, config: { ...state.config, truthfulExperience: text } },
      "experience-set",
      "Truthful experience note stored. It is added only because it was supplied here.",
      now,
    ),
    error: null,
  };
}

export function recordPlatformWarning(state: DraftState, message: string, now: Date): DraftState {
  const reason = oneLine(message, 300) || "Platform warning recorded without a message.";
  return withLog(
    { ...state, config: { ...state.config, stopped: true, stopReason: reason } },
    "warning",
    `Stopped after a platform warning: ${reason}`,
    now,
  );
}

export function acknowledgeWarning(
  state: DraftState,
  note: string,
  now: Date,
): { state: DraftState; error: string | null } {
  const text = oneLine(note, 300);
  if (!text) {
    return { state, error: "Add a short note about how you reviewed the warning." };
  }
  if (!state.config.stopped) {
    return {
      state: withLog(state, "acknowledge", "No platform stop was active.", now),
      error: null,
    };
  }
  return {
    state: withLog(
      { ...state, config: { ...state.config, stopped: false, stopReason: null } },
      "acknowledge",
      `Platform stop cleared after review: ${text} Posting remains unavailable.`,
      now,
    ),
    error: null,
  };
}

export function requestAutomatedReading(state: DraftState, now: Date): DraftState {
  return withLog(state, "reading-refused", AUTOMATION_REFUSAL, now);
}

export function requestAutomatedPosting(state: DraftState, now: Date): DraftState {
  return withLog(
    state,
    "posting-refused",
    "Automatic posting stays off. Draft-only mode is the only mode, and it cannot be switched on from configuration.",
    now,
  );
}

export interface MonitorResult {
  ran: false;
  postsRead: 0;
  automationRunning: false;
  intervalMinutes: number;
  detail: string;
}

export function runMonitor(
  state: DraftState,
  now: Date,
): { state: DraftState; result: MonitorResult } {
  const result: MonitorResult = {
    ran: false,
    postsRead: 0,
    automationRunning: false,
    intervalMinutes: state.config.monitoringIntervalMinutes,
    detail: AUTOMATION_REFUSAL,
  };
  return {
    state: withLog(state, "monitor-refused", result.detail, now),
    result,
  };
}

function normalizePost(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function postHash(text: string): string {
  return createHash("sha256").update(normalizePost(text)).digest("hex");
}

function platformKey(platformId: string | null | undefined): string | null {
  if (!platformId) return null;
  const trimmed = platformId.trim();
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(trimmed)) return null;
  return `id:${trimmed}`;
}

function keysFor(text: string, platformId: string | null | undefined): string[] {
  const keys = [`hash:${postHash(text)}`];
  const idKey = platformKey(platformId);
  if (idKey) keys.push(idKey);
  return keys;
}

function sentencesOf(text: string): string[] {
  const parts = text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

function sentenceIsRequest(sentence: string): boolean {
  if (NEGATED_REQUEST.test(sentence)) return false;
  if (REQUEST_PATTERN.test(sentence)) return true;
  if (detectServices(sentence).length > 0 && /\b(?:needs?|needed)\b/i.test(sentence)) {
    return true;
  }
  return /\?\s*$/.test(sentence) && detectServices(sentence).length > 0;
}

function detectServices(text: string): ServiceId[] {
  const withoutFloorPlans = text.replace(/\bfloor plans?\b/gi, " ");
  const found: Array<{ id: ServiceId; index: number }> = [];
  for (const rule of SERVICE_RULES) {
    const haystack = rule.id === "flooring" ? withoutFloorPlans : text;
    const match = rule.pattern.exec(haystack);
    if (match && match.index >= 0) found.push({ id: rule.id, index: match.index });
  }
  found.sort((a, b) => a.index - b.index);
  const ordered: ServiceId[] = [];
  for (const hit of found) {
    if (!ordered.includes(hit.id)) ordered.push(hit.id);
  }
  if (ordered.some((id) => id !== "remodeling")) {
    return ordered.filter((id) => id !== "remodeling");
  }
  return ordered;
}

function earliestMatch(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  return match ? match.index : null;
}

function locate(
  text: string,
): { kind: "in"; name: string } | { kind: "out"; name: string } | { kind: "unknown" } {
  let inHit: { name: string; index: number } | null = null;
  for (const name of SERVICE_AREAS) {
    const index = earliestMatch(
      text,
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    );
    if (index !== null && (inHit === null || index < inHit.index)) inHit = { name, index };
  }
  for (const zip of ZIP_AREAS) {
    const index = earliestMatch(text, zip.pattern);
    if (index !== null && (inHit === null || index < inHit.index))
      inHit = { name: zip.name, index };
  }
  if (inHit) return { kind: "in", name: inHit.name };

  let outHit: { name: string; index: number } | null = null;
  for (const name of OUTSIDE_AREAS) {
    const index = earliestMatch(text, new RegExp(`\\b${name}\\b`, "i"));
    if (index !== null && (outHit === null || index < outHit.index)) outHit = { name, index };
  }
  if (outHit) return { kind: "out", name: outHit.name };
  return { kind: "unknown" };
}

function resolveArea(text: string, neighborhood: string | null | undefined) {
  const fromPost = locate(text);
  if (fromPost.kind !== "unknown") return fromPost;
  const hint = neighborhood?.trim();
  if (!hint) return fromPost;
  return locate(hint);
}

function askedPhrase(services: ServiceId[]): string {
  const phrases = services.map((id) => SERVICE_PHRASE[id]);
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

export function buildBusinessPageReply(
  services: ServiceId[],
  area: string,
  disclosure: string,
  truthfulExperience: string | null,
): string {
  const paragraphs = [
    "We're The Flip Fixer, replying from our Business Page. Jon owns this page.",
    `You asked about ${askedPhrase(services)} in ${area}. We do kitchen and bath remodels, flooring, painting, and make-ready work in our San Antonio service area.`,
    disclosure.trim(),
  ];
  if (truthfulExperience && truthfulExperience.trim()) {
    paragraphs.push(truthfulExperience.trim());
  }
  paragraphs.push(`Call or text ${SITE.phoneDisplay}, or use ${SITE.url}/contact.`);
  return paragraphs.join("\n\n");
}

function draftsToday(state: DraftState, now: Date): number {
  const day = now.toISOString().slice(0, 10);
  return state.handled.filter((record) => record.at.slice(0, 10) === day).length;
}

function alreadyDrafted(state: DraftState, keys: string[]): HandledRecord | null {
  return state.handled.find((record) => record.keys.some((key) => keys.includes(key))) ?? null;
}

function result(
  status: IngestStatus,
  detail: string,
  extras: Partial<Pick<IngestResult, "services" | "area" | "draft">> = {},
): IngestResult {
  return {
    status,
    services: extras.services ?? [],
    area: extras.area ?? null,
    draft: extras.draft ?? null,
    posted: false,
    automationRunning: false,
    detail,
  };
}

export function ingestPost(
  state: DraftState,
  input: PostInput,
  now: Date,
): { state: DraftState; result: IngestResult } {
  if (!disclosureIsValid(state.config.relationshipDisclosure)) {
    const next = result(
      "config-error",
      "Set a disclosure that names The Flip Fixer, Jon, and the business relationship before drafting.",
    );
    return { state: withLog(state, "config-error", next.detail, now), result: next };
  }

  const text = stripControls(input.text).trim();
  if (!text) {
    const next = result("rejected", "The post was empty. Nothing was drafted.");
    return { state: withLog(state, "rejected", next.detail, now), result: next };
  }
  if (text.length > MAX_POST_CHARS) {
    const next = result("rejected", "The post is over 8000 characters. Nothing was drafted.");
    return { state: withLog(state, "rejected", next.detail, now), result: next };
  }

  const keys = keysFor(text, input.platformId);
  const prior = alreadyDrafted(state, keys);
  if (prior) {
    const next = result(
      "duplicate",
      "This request already has a draft. It was not drafted again.",
      {
        services: prior.services,
        area: prior.area,
        draft: prior.draft,
      },
    );
    return { state: withLog(state, "duplicate", next.detail, now), result: next };
  }

  if (OFFERING_SERVICE.test(text)) {
    const next = result("not-a-request", "This post offers a trade. It is not a request for one.");
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }

  const requestSentences = sentencesOf(text).filter(sentenceIsRequest);
  const servicesInRequest = detectServices(requestSentences.join(" "));
  const services =
    servicesInRequest.length > 0
      ? servicesInRequest
      : requestSentences.some((sentence) => BROAD_REQUEST.test(sentence))
        ? detectServices(text)
        : [];
  const areaHit = resolveArea(text, input.neighborhood);

  if (state.config.paused) {
    const next = result(
      "paused",
      "Pause is on. The post was classified and no reply was created.",
      {
        services,
        area: areaHit.kind === "in" ? areaHit.name : null,
      },
    );
    return { state: withLog(state, "paused-skip", next.detail, now), result: next };
  }
  if (state.config.stopped) {
    const next = result(
      "stopped",
      `Drafts are stopped after a platform warning${state.config.stopReason ? `: ${state.config.stopReason}` : ""}.`,
      { services, area: areaHit.kind === "in" ? areaHit.name : null },
    );
    return {
      state: withLog(
        state,
        "stopped-skip",
        "Draft skipped because a platform warning stopped the tool.",
        now,
      ),
      result: next,
    };
  }

  if (requestSentences.length === 0 || services.length === 0) {
    const next = result(
      "not-a-request",
      "No explicit request for remodeling, a kitchen, a bathroom, flooring, painting, or make-ready work.",
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }
  if (areaHit.kind === "out") {
    const next = result(
      "outside-service-area",
      `The request is in ${areaHit.name}, outside the service area.`,
      {
        services,
      },
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }
  if (areaHit.kind === "unknown") {
    const next = result(
      "location-unknown",
      "The post does not name a city or neighborhood in the service area. Pass the neighborhood shown on the post if you already read it.",
      { services },
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }

  if (input.channel === "personal") {
    const next = result("personal-account-blocked", PERSONAL_ACCOUNT_REFUSAL, {
      services,
      area: areaHit.name,
    });
    return {
      state: withLog(
        state,
        "personal-blocked",
        "Personal-account reply refused. No draft was created.",
        now,
      ),
      result: next,
    };
  }

  if (draftsToday(state, now) >= state.config.maxDraftsPerDay) {
    const next = result(
      "limit",
      `Local cap of ${state.config.maxDraftsPerDay} drafts per UTC day is reached. No further draft was created.`,
      { services, area: areaHit.name },
    );
    return { state: withLog(state, "limit", next.detail, now), result: next };
  }

  const draft = buildBusinessPageReply(
    services,
    areaHit.name,
    state.config.relationshipDisclosure,
    state.config.truthfulExperience,
  );
  const record: HandledRecord = {
    keys,
    platformId: platformKey(input.platformId)?.slice(3) ?? null,
    at: now.toISOString(),
    services,
    area: areaHit.name,
    draft,
  };
  const next = result("draft", "Draft created for the Business Page. It was not posted.", {
    services,
    area: areaHit.name,
    draft,
  });
  return {
    state: withLog(
      { ...state, handled: [...state.handled, record] },
      "draft-created",
      `Draft for ${services.join(", ")} in ${areaHit.name}. Not posted.`,
      now,
    ),
    result: next,
  };
}

export function statusReport(state: DraftState): string {
  const lines = [
    "Mode: draft-only",
    "Automation running: no",
    "Posts read from Nextdoor this run: 0",
    "Automatic posting: unavailable",
    `Paused: ${state.config.paused ? "yes" : "no"}`,
    `Stopped for a platform warning: ${state.config.stopped ? "yes" : "no"}`,
    state.config.stopReason ? `Stop reason: ${state.config.stopReason}` : "",
    `Stored monitoring interval: ${state.config.monitoringIntervalMinutes} minutes (not scheduled)`,
    `Local draft cap: ${state.config.maxDraftsPerDay} per UTC day`,
    `Drafts stored: ${state.handled.length}`,
    `Disclosure set: ${disclosureIsValid(state.config.relationshipDisclosure) ? "yes" : "no"}`,
    `Truthful experience note: ${state.config.truthfulExperience ? "set" : "not set"}`,
    "",
    AUTOMATION_REFUSAL,
    "",
    "Policy reviewed 2026-10-15.",
    ...POLICY_SOURCES.map((source) => `Source: ${source}`),
  ];
  return lines.filter((line) => line !== "").join("\n");
}

export type CliCommand =
  | { type: "help" }
  | { type: "status" }
  | { type: "log" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "monitor" }
  | { type: "enable-reading" }
  | { type: "enable-posting" }
  | { type: "interval"; minutes: number }
  | { type: "cap"; cap: number }
  | { type: "disclosure"; text: string }
  | { type: "experience"; text: string | null }
  | { type: "warning"; text: string }
  | { type: "acknowledge"; text: string }
  | {
      type: "draft";
      channel: Channel;
      platformId: string | null;
      neighborhood: string | null;
      text: string | null;
      file: string | null;
      useStdin: boolean;
    };

export function parseCliArgs(argv: string[]): { command: CliCommand } | { error: string } {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { command: { type: "help" } };
  }
  switch (command) {
    case "status":
    case "log":
    case "pause":
    case "resume":
    case "monitor":
    case "enable-reading":
    case "enable-posting":
      if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
      return { command: { type: command } };
    case "interval":
      return parseNumberCommand(rest, "interval");
    case "cap":
      return parseNumberCommand(rest, "cap");
    case "disclosure":
      return { command: { type: "disclosure", text: rest.join(" ").trim() } };
    case "experience":
      if (rest[0] === "--clear") {
        if (rest.length > 1) return { error: `unexpected argument: ${rest[1]}` };
        return { command: { type: "experience", text: null } };
      }
      return { command: { type: "experience", text: rest.join(" ").trim() } };
    case "warning":
      return { command: { type: "warning", text: rest.join(" ").trim() } };
    case "acknowledge":
      return { command: { type: "acknowledge", text: rest.join(" ").trim() } };
    case "draft":
      return parseDraftArgs(rest);
    default:
      return { error: `unknown command: ${command}` };
  }
}

function parseNumberCommand(
  rest: string[],
  type: "interval" | "cap",
): { command: CliCommand } | { error: string } {
  if (rest.length !== 1 || !/^\d+$/.test(rest[0])) {
    return { error: `usage: ${type} <whole number>` };
  }
  const value = Number(rest[0]);
  if (type === "interval") return { command: { type: "interval", minutes: value } };
  return { command: { type: "cap", cap: value } };
}

function parseDraftArgs(rest: string[]): { command: CliCommand } | { error: string } {
  let channel: Channel | null = null;
  let platformId: string | null = null;
  let neighborhood: string | null = null;
  let text: string | null = null;
  let file: string | null = null;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--text") {
      text = rest
        .slice(index + 1)
        .join(" ")
        .trim();
      break;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) return { error: `${flag} needs a value` };
    if (flag === "--channel") {
      if (value !== "business-page" && value !== "personal") {
        return { error: "--channel must be business-page or personal" };
      }
      channel = value;
      index += 1;
    } else if (flag === "--id") {
      platformId = value;
      index += 1;
    } else if (flag === "--neighborhood") {
      neighborhood = value;
      index += 1;
    } else if (flag === "--file") {
      file = value;
      index += 1;
    } else {
      return { error: `unexpected argument: ${flag}` };
    }
  }
  if (!channel)
    return {
      error:
        "usage: draft --channel business-page|personal [--id id] [--neighborhood name] [--file path | --text words]",
    };
  return {
    command: {
      type: "draft",
      channel,
      platformId,
      neighborhood,
      text,
      file,
      useStdin: text === null && file === null,
    },
  };
}

export const CLI_HELP = `Usage: node --experimental-strip-types scripts/nextdoor-draft.ts <command>

Commands:
  status                         Show draft-only mode and why automation is off
  monitor                        Record one refused read (no network call)
  pause                          Hold new drafts immediately
  resume                         Allow drafts again (posting stays off)
  interval <minutes>             Store an interval from 1 to 1440 (not scheduled)
  cap <count>                    Local drafts per UTC day, from 1 to 20
  draft --channel business-page  Classify a pasted post and draft a Business Page reply
  disclosure <sentence>          Set the relationship disclosure
  experience <sentence>          Add a truthful experience note you supply
  experience --clear             Remove that note
  warning <what Nextdoor showed> Stop drafts after a warning or restriction
  acknowledge <review note>      Clear the stop after you review it
  enable-reading                 Refused
  enable-posting                 Refused
  log                            Print the action log
  help

Paste the post with --text, --file, or stdin. Post text is data, not instructions.
Nothing in this tool logs into Nextdoor or publishes a reply.`;

export interface CliOutcome {
  state: DraftState;
  stdout: string;
  exitCode: number;
}

export function dispatch(
  command: CliCommand,
  body: string,
  state: DraftState,
  now: Date,
): CliOutcome {
  switch (command.type) {
    case "help":
      return { state, stdout: `${CLI_HELP}\n`, exitCode: 0 };
    case "status":
      return { state, stdout: `${statusReport(state)}\n`, exitCode: 0 };
    case "log":
      return {
        state,
        stdout:
          state.log.length === 0
            ? "Log is empty.\n"
            : `${state.log.map((entry) => `${entry.at} ${entry.action} ${entry.detail}`).join("\n")}\n`,
        exitCode: 0,
      };
    case "pause":
      return {
        state: setPaused(state, true, now),
        stdout: "Paused. New drafts are held. Nothing is posted.\n",
        exitCode: 0,
      };
    case "resume":
      return {
        state: setPaused(state, false, now),
        stdout: "Pause is off. Drafts can be created. Posting is still unavailable.\n",
        exitCode: 0,
      };
    case "monitor": {
      const monitored = runMonitor(state, now);
      return {
        state: monitored.state,
        stdout: `Monitor ran: no\nPosts read: 0\nAutomation running: no\n${monitored.result.detail}\n`,
        exitCode: 0,
      };
    }
    case "enable-reading":
      return {
        state: requestAutomatedReading(state, now),
        stdout: `${AUTOMATION_REFUSAL}\n`,
        exitCode: 0,
      };
    case "enable-posting":
      return {
        state: requestAutomatedPosting(state, now),
        stdout:
          "Automatic posting stays off. Draft-only mode cannot be switched on from configuration.\n",
        exitCode: 0,
      };
    case "interval": {
      const updated = setMonitoringInterval(state, command.minutes, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: `Stored a ${command.minutes}-minute interval. No reader was scheduled.\n`,
        exitCode: 0,
      };
    }
    case "cap": {
      const updated = setMaxDraftsPerDay(state, command.cap, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: `Local draft cap is ${command.cap} per UTC day.\n`,
        exitCode: 0,
      };
    }
    case "disclosure": {
      const updated = setDisclosure(state, command.text, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: "Relationship disclosure updated.\n",
        exitCode: 0,
      };
    }
    case "experience": {
      const updated = setTruthfulExperience(state, command.text, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout:
          command.text === null
            ? "Truthful experience note cleared.\n"
            : "Truthful experience note stored.\n",
        exitCode: 0,
      };
    }
    case "warning":
      return {
        state: recordPlatformWarning(state, command.text, now),
        stdout:
          "Stopped. Further drafts are held until you acknowledge the warning. Posting was already off.\n",
        exitCode: 0,
      };
    case "acknowledge": {
      const updated = acknowledgeWarning(state, command.text, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: "Recorded. Posting remains unavailable.\n",
        exitCode: 0,
      };
    }
    case "draft": {
      const text = command.text ?? body;
      const ingested = ingestPost(
        state,
        {
          text,
          channel: command.channel,
          platformId: command.platformId,
          neighborhood: command.neighborhood,
        },
        now,
      );
      return {
        state: ingested.state,
        stdout: formatIngest(ingested.result),
        exitCode: 0,
      };
    }
    default:
      return { state, stdout: "Unknown command.\n", exitCode: 1 };
  }
}

function formatIngest(value: IngestResult): string {
  const lines = [
    `Status: ${value.status}`,
    `Services: ${value.services.length > 0 ? value.services.join(", ") : "none"}`,
    `Area: ${value.area ?? "none"}`,
    "Posted: no",
    "Automation running: no",
    "",
    value.detail,
  ];
  if (value.draft) {
    lines.push("", "--- reply ---", value.draft, "--- end ---");
  }
  return `${lines.join("\n")}\n`;
}

export function serializeState(state: DraftState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function loadState(raw: string): DraftState {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("State file is not an object.");
  const record = parsed as Partial<DraftState>;
  if (record.version !== 1) throw new Error("Unsupported state version.");
  const config = record.config;
  if (!config || typeof config !== "object") throw new Error("State file is missing config.");
  const base = defaultConfig();
  const loaded: NextdoorDraftConfig = {
    paused: config.paused === true,
    stopped: config.stopped === true,
    stopReason: typeof config.stopReason === "string" ? oneLine(config.stopReason, 300) : null,
    monitoringIntervalMinutes:
      typeof config.monitoringIntervalMinutes === "number" &&
      Number.isInteger(config.monitoringIntervalMinutes) &&
      config.monitoringIntervalMinutes >= MIN_INTERVAL_MINUTES &&
      config.monitoringIntervalMinutes <= MAX_INTERVAL_MINUTES
        ? config.monitoringIntervalMinutes
        : base.monitoringIntervalMinutes,
    maxDraftsPerDay:
      typeof config.maxDraftsPerDay === "number" &&
      Number.isInteger(config.maxDraftsPerDay) &&
      config.maxDraftsPerDay >= MIN_DAILY_CAP &&
      config.maxDraftsPerDay <= MAX_DAILY_CAP
        ? config.maxDraftsPerDay
        : base.maxDraftsPerDay,
    relationshipDisclosure:
      typeof config.relationshipDisclosure === "string" &&
      disclosureIsValid(config.relationshipDisclosure)
        ? config.relationshipDisclosure.trim()
        : base.relationshipDisclosure,
    truthfulExperience:
      typeof config.truthfulExperience === "string" && config.truthfulExperience.trim()
        ? oneLine(config.truthfulExperience, 400)
        : null,
  };
  const handled = Array.isArray(record.handled) ? record.handled.filter(isHandledRecord) : [];
  const log = Array.isArray(record.log) ? record.log.filter(isLogEntry).slice(-MAX_LOG) : [];
  return { version: 1, config: loaded, handled, log };
}

function isHandledRecord(value: unknown): value is HandledRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as HandledRecord;
  return (
    Array.isArray(record.keys) &&
    record.keys.every((key) => typeof key === "string") &&
    (record.platformId === null || typeof record.platformId === "string") &&
    typeof record.at === "string" &&
    Array.isArray(record.services) &&
    typeof record.area === "string" &&
    typeof record.draft === "string"
  );
}

function isLogEntry(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LogEntry;
  return (
    typeof entry.at === "string" &&
    typeof entry.action === "string" &&
    typeof entry.detail === "string"
  );
}
