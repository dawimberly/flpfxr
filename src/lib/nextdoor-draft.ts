/**
 * Draft-only helper for Nextdoor recommendation replies.
 *
 * Nothing in this module connects to Nextdoor. Automated reading and posting
 * stay off: no approved API client is configured, and the documented APIs do
 * not read a logged-in neighborhood feed. Flagging risk does not turn reading on.
 *
 * The default poster is an independent neighbor. Service and area claims come
 * only from a verified business profile the operator supplies. The neighbor's
 * post identifies the request. An uncertain match is flagged and not asserted.
 */
import { createHash } from "node:crypto";
import { SERVICE_AREAS } from "./site.ts";

export const POLICY_REVIEWED_ON = "2026-10-15";

export const AUTOMATION_REFUSAL =
  "Whether a run would be flagged is not a reason to read the account. Automated Nextdoor reading and posting are off. No supported feed integration is configured. The Member Agreement forbids scripts, robots, crawlers, and other automated means of copying profiles or other data off the service. The Publish API and the Displaying Content APIs require an approved application; this project has no client id or access token, and the open Share Plugin only pre-fills a post a person submits by hand. The Displaying Search API, even after approval, returns public anyone-visibility posts from the last 30 days, not a logged-in neighborhood feed.";

export const POLICY_PASSAGES = [
  {
    source: "https://blog.nextdoor.com/self-promotion-update",
    published: "August 19, 2026",
    passage:
      "Promoting a business, service, or paid opportunity can still happen on Nextdoor but it must be done from a free Business Page, not a personal neighbor account. For the last few years, businesses have increasingly used neighbor accounts to post promotional content from personal accounts rather than Business Pages. That includes posts and comments in the main feed, as well as unsolicited direct messages.",
  },
  {
    source: "https://blog.nextdoor.com/self-promotion-update",
    published: "August 19, 2026",
    passage:
      "Nothing about your Nextdoor changes. Asking who to call, recommending a business you love, posting a garage sale, or selling a couch are all still welcome from your personal account.",
  },
  {
    source: "https://nextdoorcrm.my.site.com/s/article/Self-Promotion-using-your-Personal-Account",
    published: "Help article, retrieved October 15, 2026",
    passage:
      'When a neighbor asks for a recommendation (e.g., "Who is a great plumber?"), you may not reply to recommend your own business. These replies must come from other neighbors or your business profile.',
  },
  {
    source: "https://nextdoorcrm.my.site.com/s/article/Self-Promotion-using-your-Personal-Account",
    published: "Help article, retrieved October 15, 2026",
    passage:
      "Posts from family, staff, or close friends on behalf of a business are treated as business promotion and are not allowed in the feed.",
  },
  {
    source: "https://nextdoorcrm.my.site.com/s/article/Self-Promotion-using-your-Personal-Account",
    published: "Help article, retrieved October 15, 2026",
    passage:
      "Yes, you can provide a neighbor recommendation for another service provider as long as there isn’t a relationship, referral benefit, or other conflict of interest.",
  },
] as const;

export const CONFLICT_REFUSAL =
  "No draft was created. The recorded relationship is a conflict with an independent recommendation. Nextdoor's self-promotion FAQ says you may not reply from a personal account to recommend your own business, and that posts from family, staff, or close friends on behalf of a business are treated as business promotion. Jon owns the Business Page. This tool does not operate that page and will not write in its voice.";

export const BUSINESS_PAGE_REFUSAL =
  "No draft was created. Jon owns The Flip Fixer Business Page. This account does not operate that page, so the reply is not written as the business. An independent neighbor draft uses --channel personal.";

export const API_APPLICATION = `API application: https://developer.nextdoor.com/reference/applying-for-access. Submit the Publishing API form, the Displaying API form, or both. Nextdoor reviews each application against its current program criteria, and approval is not guaranteed. An approval email includes a client id and client secret. This project has neither.

Publishing is OAuth. After approval, the member opens https://www.nextdoor.com/v3/authorize/ with the redirect URI from the application and scopes such as openid, post:write, post:read, and comment:write, then the app exchanges the code for a bearer token. post:write creates a post. comment:write creates a comment only when the caller already has that post's share id. The authenticated profile can be a neighbor or a business profile.

Displaying Search uses a client-credentials token. Scopes include openid and content_api.search_post. The Search API returns public anyone-visibility posts from the last 30 days for a latitude, longitude, radius, and keywords. It does not read a logged-in neighborhood feed. https://developer.nextdoor.com/docs/displaying-overview

Those APIs do not cover hourly reading of a personal neighborhood feed plus automatic replies. comment:write could post a comment only after approval, member consent, and a known share id, and the self-promotion rules would still apply. That path is not configured. The Ads API is a separate application for advertising partners. The Share Plugin needs no application and only opens Nextdoor's composer for a person to submit by hand.`;

export const POLICY_SOURCES = [
  "https://blog.nextdoor.com/self-promotion-update",
  "https://nextdoorcrm.my.site.com/s/article/Self-Promotion-using-your-Personal-Account",
  "https://developer.nextdoor.com/reference/applying-for-access",
  "https://developer.nextdoor.com/docs/displaying-overview",
  "https://developer.nextdoor.com/docs/sharing-overview",
  "https://developer.nextdoor.com/reference/sharing-get-authorization-code",
  "https://developer.nextdoor.com/reference/displaying-get-access-token",
  "https://help.nextdoor.com/s/article/Member-Agreement-US-2026",
] as const;

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

export const POSTER_RELATIONSHIPS = [
  "independent",
  "owner",
  "employee",
  "compensated",
  "family-or-close-friend",
] as const;

export type PosterRelationship = (typeof POSTER_RELATIONSHIPS)[number];

export interface NextdoorDraftConfig {
  paused: boolean;
  stopped: boolean;
  stopReason: string | null;
  monitoringIntervalMinutes: number;
  maxDraftsPerDay: number;
  relationship: PosterRelationship;
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

export interface VerifiedBusinessProfile {
  verified: true;
  businessName: string;
  ownerName: string | null;
  phone: string | null;
  services: ServiceId[];
  serviceAreas: string[];
}

export type BusinessProfile = { verified: false } | VerifiedBusinessProfile;

export interface DraftState {
  version: 2;
  config: NextdoorDraftConfig;
  profile: BusinessProfile;
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
  | "needs-review"
  | "conflict-blocked"
  | "business-page-unavailable"
  | "limit"
  | "rejected";

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
  kitchen: "kitchen remodels",
  bathroom: "bathroom remodels",
  flooring: "flooring",
  painting: "painting",
  "make-ready": "make-ready work",
  remodeling: "remodels",
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

const SERVICE_ID_LIST: ServiceId[] = [
  "kitchen",
  "bathroom",
  "flooring",
  "painting",
  "make-ready",
  "remodeling",
];

const ZIP_AREAS: Array<{ name: string; pattern: RegExp }> = [
  { name: "San Antonio", pattern: /\b782\d{2}\b/ },
  { name: "Boerne", pattern: /\b78006\b/ },
  { name: "Fair Oaks Ranch", pattern: /\b78015\b/ },
  { name: "Helotes", pattern: /\b78023\b/ },
  { name: "Kerrville", pattern: /\b78028\b|\b78029\b/ },
];

export function emptyProfile(): BusinessProfile {
  return { verified: false };
}

export function initialState(partial: Partial<NextdoorDraftConfig> = {}): DraftState {
  return {
    version: 2,
    config: { ...defaultConfig(), ...partial },
    profile: emptyProfile(),
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
    relationship: "independent",
    truthfulExperience: null,
  };
}

function isPosterRelationship(value: string): value is PosterRelationship {
  return (POSTER_RELATIONSHIPS as readonly string[]).includes(value);
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

export function setRelationship(
  state: DraftState,
  relationship: string,
  now: Date,
): { state: DraftState; error: string | null } {
  const value = relationship.trim();
  if (!isPosterRelationship(value)) {
    return {
      state,
      error: `Relationship must be one of: ${POSTER_RELATIONSHIPS.join(", ")}.`,
    };
  }
  const detail =
    value === "independent"
      ? "Relationship set to independent. No ownership, staff role, compensation, or hiring is on record. Jon owns the business."
      : `Relationship set to ${value}. Personal drafts are blocked, and this tool will not write Jon's Business Page.`;
  return {
    state: withLog(
      { ...state, config: { ...state.config, relationship: value } },
      "relationship-set",
      detail,
      now,
    ),
    error: null,
  };
}

export function setBusinessProfile(
  state: DraftState,
  raw: unknown,
  now: Date,
): { state: DraftState; error: string | null } {
  const parsed = parseBusinessProfile(raw);
  if (parsed.error || !parsed.profile) return { state, error: parsed.error };
  const detail = parsed.profile.verified
    ? `Verified profile stored for ${parsed.profile.businessName}. Claims are limited to its services and areas.`
    : "Profile stored as not verified. No service or area will be asserted.";
  return {
    state: withLog({ ...state, profile: parsed.profile }, "profile-set", detail, now),
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
      "Truthful experience note stored. It is not added to the recommendation.",
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

type AreaHit =
  | { kind: "in"; name: string; source: "named" | "zip" }
  | { kind: "out"; name: string }
  | { kind: "unknown" };

function locate(text: string, extraNames: readonly string[] = []): AreaHit {
  const names = [...SERVICE_AREAS, ...extraNames];
  let named: { name: string; index: number } | null = null;
  for (const name of names) {
    const index = earliestMatch(
      text,
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    );
    if (index !== null && (named === null || index < named.index)) named = { name, index };
  }
  if (named) return { kind: "in", name: named.name, source: "named" };

  for (const zip of ZIP_AREAS) {
    const index = earliestMatch(text, zip.pattern);
    if (index !== null) return { kind: "in", name: zip.name, source: "zip" };
  }

  let outHit: { name: string; index: number } | null = null;
  for (const name of OUTSIDE_AREAS) {
    const index = earliestMatch(text, new RegExp(`\\b${name}\\b`, "i"));
    if (index !== null && (outHit === null || index < outHit.index)) outHit = { name, index };
  }
  if (outHit) return { kind: "out", name: outHit.name };
  return { kind: "unknown" };
}

function resolveArea(
  text: string,
  neighborhood: string | null | undefined,
  extraNames: readonly string[],
): AreaHit {
  const fromPost = locate(text, extraNames);
  if (fromPost.kind !== "unknown") return fromPost;
  const hint = neighborhood?.trim();
  if (!hint) return fromPost;
  const fromHint = locate(hint, extraNames);
  if (fromHint.kind === "in") return { kind: "in", name: fromHint.name, source: "named" };
  return fromHint;
}

function namedArea(hit: AreaHit): string | null {
  return hit.kind === "in" && hit.source === "named" ? hit.name : null;
}

function askedPhrase(services: ServiceId[]): string {
  const phrases = services.map((id) => SERVICE_PHRASE[id]);
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

const DETAIL_RULES: Array<{
  pattern: RegExp;
  label: string;
  kind: "part" | "place" | "purpose";
  services?: ServiceId[];
}> = [
  { pattern: /\bvinyl plank\b|\blvp\b/i, label: "LVP", kind: "part" },
  { pattern: /\bhardwood\b/i, label: "hardwood", kind: "part" },
  { pattern: /\blaminate\b/i, label: "laminate", kind: "part" },
  {
    pattern: /\btile\b/i,
    label: "tile",
    kind: "part",
    services: ["flooring", "bathroom", "kitchen"],
  },
  { pattern: /\bcabinets?\b/i, label: "cabinets", kind: "part", services: ["kitchen"] },
  {
    pattern: /\bcountertops?\b|\bcounters?\b/i,
    label: "countertops",
    kind: "part",
    services: ["kitchen", "bathroom"],
  },
  { pattern: /\bshowers?\b/i, label: "a shower", kind: "part", services: ["bathroom"] },
  { pattern: /\binteriors?\b/i, label: "interior", kind: "place", services: ["painting"] },
  { pattern: /\bexteriors?\b/i, label: "exterior", kind: "place", services: ["painting"] },
  { pattern: /\bdownstairs\b/i, label: "downstairs", kind: "place" },
  { pattern: /\bupstairs\b/i, label: "upstairs", kind: "place" },
  { pattern: /\b(before we list|listings?|for sale)\b/i, label: "for a listing", kind: "purpose" },
  { pattern: /\b(rentals?|tenants?)\b/i, label: "for a rental", kind: "purpose" },
];

function extractDetails(
  text: string,
  services: ServiceId[],
): { parts: string[]; places: string[]; purposes: string[] } {
  const found: Array<{ label: string; kind: "part" | "place" | "purpose"; index: number }> = [];
  for (const rule of DETAIL_RULES) {
    if (rule.services && !rule.services.some((service) => services.includes(service))) continue;
    const match = rule.pattern.exec(text);
    if (!match) continue;
    found.push({ label: rule.label, kind: rule.kind, index: match.index });
  }
  found.sort((a, b) => a.index - b.index);
  const parts: string[] = [];
  const places: string[] = [];
  const purposes: string[] = [];
  for (const detail of found) {
    const bucket = detail.kind === "part" ? parts : detail.kind === "place" ? places : purposes;
    if (!bucket.includes(detail.label) && parts.length + places.length + purposes.length < 3) {
      bucket.push(detail.label);
    }
  }
  return { parts, places, purposes };
}

function joinLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function uncertainScopes(text: string): string[] {
  const reasons: string[] = [];
  if (/\bcabinets?\b/i.test(text)) reasons.push("cabinets");
  if (/\bcountertops?\b|\bcounters?\b/i.test(text)) reasons.push("countertops");
  if (/\bshowers?\b/i.test(text) && !/\bbathrooms?\b|\bbath remodel\b/i.test(text)) {
    reasons.push("a shower");
  }
  if (/\btile\b/i.test(text) && !/\btile floors?\b|\bfloor tile\b/i.test(text))
    reasons.push("tile");
  return reasons;
}

function needPhrase(text: string, services: ServiceId[], area: string): string {
  const { parts, places, purposes } = extractDetails(text, services);
  const lead = [...places, ...parts];
  const work = services.length > 0 ? askedPhrase(services) : "the work described";
  const purpose = purposes.length > 0 ? ` ${joinLabels(purposes)}` : "";
  const core = lead.length > 0 ? `${joinLabels(lead)} ${work}` : work;
  return `${core}${purpose} in ${area}`;
}

export function buildNeighborReply(
  services: ServiceId[],
  area: string,
  postText: string,
  profile: VerifiedBusinessProfile,
): string {
  const sentences = [
    `You asked about ${needPhrase(postText, services, area)}.`,
    `${profile.businessName}'s verified profile lists ${askedPhrase(services)} in ${area}.`,
  ];
  if (profile.ownerName) sentences.push(`${profile.ownerName} is the owner on that profile.`);
  if (profile.phone)
    sentences.push(profile.phone.endsWith(".") ? profile.phone : `${profile.phone}.`);
  return sentences.join(" ");
}

function reviewBeforeClaim(
  profile: BusinessProfile,
  services: ServiceId[],
  uncertain: string[],
  area: string,
): string | null {
  if (uncertain.length > 0) {
    return `The post mentions ${uncertain.join(", ")}. That scope is not a verified profile service, so no capability was asserted.`;
  }
  if (!profile.verified) {
    return "No verified business profile is on file. No service or area was asserted.";
  }
  const missing = services.filter((service) => !profile.services.includes(service));
  if (services.length === 0 || missing.length > 0) {
    return `The post asks for ${missing.length > 0 ? missing.join(", ") : "work that is not specific"}. That is not on the verified profile, so it was not asserted.`;
  }
  if (!onProfile(area, profile.serviceAreas)) {
    return `The post names ${area}. That place is not on the verified profile, so no service area was asserted.`;
  }
  return null;
}

function profileAreaNames(profile: BusinessProfile): string[] {
  return profile.verified ? profile.serviceAreas : [];
}

function onProfile(name: string, areas: string[]): boolean {
  const wanted = name.toLowerCase();
  return areas.some((area) => area.toLowerCase() === wanted);
}

function parseBusinessProfile(raw: unknown): {
  profile: BusinessProfile | null;
  error: string | null;
} {
  if (!raw || typeof raw !== "object")
    return { profile: null, error: "Profile JSON must be an object." };
  const record = raw as Record<string, unknown>;
  if (record.verified !== true) return { profile: emptyProfile(), error: null };
  const businessName = typeof record.businessName === "string" ? record.businessName.trim() : "";
  if (!businessName) {
    return { profile: null, error: "A verified profile needs a businessName." };
  }
  if (!Array.isArray(record.services) || record.services.length === 0) {
    return { profile: null, error: "A verified profile needs at least one service." };
  }
  const services: ServiceId[] = [];
  for (const service of record.services) {
    if (typeof service !== "string" || !SERVICE_ID_LIST.includes(service as ServiceId)) {
      return { profile: null, error: `Unknown service: ${String(service)}.` };
    }
    if (!services.includes(service as ServiceId)) services.push(service as ServiceId);
  }
  if (!Array.isArray(record.serviceAreas) || record.serviceAreas.length === 0) {
    return { profile: null, error: "A verified profile needs at least one service area." };
  }
  const serviceAreas: string[] = [];
  for (const area of record.serviceAreas) {
    if (typeof area !== "string" || !area.trim()) {
      return { profile: null, error: "Service areas must be non-empty names." };
    }
    serviceAreas.push(area.trim());
  }
  const ownerName =
    typeof record.ownerName === "string" && record.ownerName.trim()
      ? record.ownerName.trim()
      : null;
  const phone =
    typeof record.phone === "string" && record.phone.trim() ? oneLine(record.phone, 40) : null;
  return {
    profile: { verified: true, businessName, ownerName, phone, services, serviceAreas },
    error: null,
  };
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
  if (prior && input.channel === "personal" && state.config.relationship === "independent") {
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
  const areaHit = resolveArea(text, input.neighborhood, profileAreaNames(state.profile));
  const uncertain = uncertainScopes(text);

  if (state.config.paused) {
    const next = result(
      "paused",
      "Pause is on. The post was classified and no reply was created.",
      {
        services,
        area: namedArea(areaHit),
      },
    );
    return { state: withLog(state, "paused-skip", next.detail, now), result: next };
  }
  if (state.config.stopped) {
    const next = result(
      "stopped",
      `Drafts are stopped after a platform warning${state.config.stopReason ? `: ${state.config.stopReason}` : ""}.`,
      { services, area: namedArea(areaHit) },
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

  if (requestSentences.length === 0 || (services.length === 0 && uncertain.length === 0)) {
    const next = result(
      "not-a-request",
      "No explicit request for remodeling, a kitchen, a bathroom, flooring, painting, or make-ready work.",
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }
  if (areaHit.kind === "out") {
    const next = result(
      "outside-service-area",
      `The post names ${areaHit.name}. No service area was asserted.`,
      { services },
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }
  if (areaHit.kind === "unknown") {
    const next = result(
      "location-unknown",
      "The post does not name a place. No service area was asserted.",
      { services },
    );
    return { state: withLog(state, "skipped", next.detail, now), result: next };
  }
  if (areaHit.source === "zip") {
    const next = result(
      "needs-review",
      `The post uses a ZIP code instead of a place name. ${areaHit.name} was not asserted as a service area.`,
      { services },
    );
    return { state: withLog(state, "needs-review", next.detail, now), result: next };
  }

  if (state.config.relationship !== "independent") {
    const next = result("conflict-blocked", CONFLICT_REFUSAL, {
      services,
      area: namedArea(areaHit),
    });
    return {
      state: withLog(
        state,
        "conflict-blocked",
        `No draft. Recorded relationship is ${state.config.relationship}.`,
        now,
      ),
      result: next,
    };
  }

  if (input.channel === "business-page") {
    const next = result("business-page-unavailable", BUSINESS_PAGE_REFUSAL, {
      services,
      area: namedArea(areaHit),
    });
    return {
      state: withLog(
        state,
        "business-page-refused",
        "No Business Page draft. This account does not operate Jon's page.",
        now,
      ),
      result: next,
    };
  }

  const review = reviewBeforeClaim(state.profile, services, uncertain, areaHit.name);
  if (review || !state.profile.verified) {
    const detail =
      review ?? "No verified business profile is on file. No service or area was asserted.";
    const next = result("needs-review", detail, { services, area: areaHit.name });
    return { state: withLog(state, "needs-review", detail, now), result: next };
  }

  if (draftsToday(state, now) >= state.config.maxDraftsPerDay) {
    const next = result(
      "limit",
      `Local cap of ${state.config.maxDraftsPerDay} drafts per UTC day is reached. No further draft was created.`,
      { services, area: areaHit.name },
    );
    return { state: withLog(state, "limit", next.detail, now), result: next };
  }

  const draft = buildNeighborReply(services, areaHit.name, text, state.profile);
  const record: HandledRecord = {
    keys,
    platformId: platformKey(input.platformId)?.slice(3) ?? null,
    at: now.toISOString(),
    services,
    area: areaHit.name,
    draft,
  };
  const next = result("draft", "Personal-account draft created. It was not posted.", {
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

function relationshipSummary(config: NextdoorDraftConfig): string {
  const experience = config.truthfulExperience
    ? "A note is stored and is not added to the recommendation."
    : "No hiring is on record.";
  if (config.relationship === "independent") {
    return `On record: not the owner, not staff, and no compensation. ${experience}`;
  }
  return `On record: ${config.relationship}. That conflicts with an independent recommendation. ${experience}`;
}

function profileSummary(profile: BusinessProfile): string {
  if (!profile.verified) {
    return "Verified business profile: no. No service or area will be asserted.";
  }
  return `Verified business profile: ${profile.businessName}. Services: ${profile.services.join(", ")}. Areas: ${profile.serviceAreas.join(", ")}.`;
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
    `Poster relationship: ${state.config.relationship}`,
    relationshipSummary(state.config),
    profileSummary(state.profile),
    `Truthful experience note: ${state.config.truthfulExperience ? "set" : "not set"}`,
    state.config.relationship === "independent"
      ? "Personal-account drafts: allowed only when the verified profile lists the requested service and area."
      : "Personal-account drafts: blocked because the recorded relationship is a conflict.",
    "Business Page drafts: not created. This account does not operate Jon's page.",
    "",
    AUTOMATION_REFUSAL,
    "",
    "Personal-account policy passages:",
    ...POLICY_PASSAGES.map((item) => `${item.published} — ${item.source}\n"${item.passage}"`),
    "",
    API_APPLICATION,
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
  | { type: "relationship"; relationship: string }
  | { type: "profile-show" }
  | { type: "profile-set"; file: string | null; json: string | null }
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
    case "relationship":
      return { command: { type: "relationship", relationship: rest.join(" ").trim() } };
    case "profile":
      return parseProfileCommand(rest);
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

function parseProfileCommand(rest: string[]): { command: CliCommand } | { error: string } {
  if (rest.length === 0) return { command: { type: "profile-show" } };
  if (rest[0] !== "set") return { error: "usage: profile | profile set --file path" };
  let file: string | null = null;
  let json: string | null = null;
  for (let index = 1; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--json") {
      json = rest
        .slice(index + 1)
        .join(" ")
        .trim();
      break;
    }
    const value = rest[index + 1];
    if (flag === "--file") {
      if (!value) return { error: "--file needs a path" };
      file = value;
      index += 1;
    } else {
      return { error: `unexpected argument: ${flag}` };
    }
  }
  return { command: { type: "profile-set", file, json } };
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
        "usage: draft --channel personal|business-page [--id id] [--neighborhood name] [--file path | --text words]",
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
  draft --channel personal       Classify a pasted post and draft an independent neighbor reply
  relationship <value>           independent, owner, employee, compensated, or family-or-close-friend
  profile                        Show the verified business profile
  profile set --file <path>      Store a profile you mark verified: true
  experience <sentence>          Store a note. It is not added to the recommendation.
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
    case "relationship": {
      const updated = setRelationship(state, command.relationship, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: `${updated.state.log.at(-1)?.detail ?? "Relationship updated."}\n`,
        exitCode: 0,
      };
    }
    case "profile-show":
      return { state, stdout: `${profileSummary(state.profile)}\n`, exitCode: 0 };
    case "profile-set": {
      const rawText = command.json ?? body;
      if (!rawText.trim()) {
        return { state, stdout: "usage: profile set --file path\n", exitCode: 1 };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        return { state, stdout: "Profile file is not valid JSON.\n", exitCode: 1 };
      }
      const updated = setBusinessProfile(state, parsed, now);
      if (updated.error) return { state, stdout: `${updated.error}\n`, exitCode: 1 };
      return {
        state: updated.state,
        stdout: `${updated.state.log.at(-1)?.detail ?? "Profile stored."}\n`,
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
            : "Truthful experience note stored. It is not added to the recommendation.\n",
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
  const record = parsed as {
    version?: unknown;
    config?: Partial<NextdoorDraftConfig> & { relationshipDisclosure?: unknown };
    handled?: unknown;
    log?: unknown;
    profile?: unknown;
  };
  if (record.version !== 1 && record.version !== 2) throw new Error("Unsupported state version.");
  const config = record.config;
  if (!config || typeof config !== "object") throw new Error("State file is missing config.");
  const base = defaultConfig();
  const rawRelationship =
    "relationship" in config && typeof config.relationship === "string" ? config.relationship : "";
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
    relationship: isPosterRelationship(rawRelationship) ? rawRelationship : base.relationship,
    truthfulExperience:
      typeof config.truthfulExperience === "string" && config.truthfulExperience.trim()
        ? oneLine(config.truthfulExperience, 400)
        : null,
  };
  const handled = Array.isArray(record.handled) ? record.handled.filter(isHandledRecord) : [];
  const log = Array.isArray(record.log) ? record.log.filter(isLogEntry).slice(-MAX_LOG) : [];
  const storedProfile = parseBusinessProfile(record.profile);
  return {
    version: 2,
    config: loaded,
    profile: storedProfile.profile ?? emptyProfile(),
    handled,
    log,
  };
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
