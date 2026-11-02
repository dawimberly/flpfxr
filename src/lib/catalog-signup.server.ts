import { catalogProjectLabel, catalogRedirectUrl, catalogSignupMessage } from "./catalog-gate.ts";
import { handleLeadFormData } from "./lead-submit.server.ts";
import { formString, isHoneypot } from "./lead-request.ts";

const AD_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "landing_path",
  "first_landing_path",
  "page_url",
] as const;

export async function handleCatalogSignup(
  form: FormData,
  request: Request,
  deps: { handleLead?: typeof handleLeadFormData; catalogUrl?: string } = {},
): Promise<Response> {
  const submissionId = formString(form, "submissionId").trim();
  if (isHoneypot(form)) {
    return Response.json({ ok: true, discarded: true, submissionId });
  }
  const projectId = formString(form, "project_type").trim();
  const label = catalogProjectLabel(projectId);
  if (!label) {
    return Response.json({ ok: false, code: "validation", message: "Choose a project type." }, { status: 400 });
  }
  if (!formString(form, "email").trim()) {
    return Response.json(
      { ok: false, code: "validation", message: "Add an email so we can open the catalog for you." },
      { status: 400 },
    );
  }
  const next = new FormData();
  next.set("submissionId", submissionId);
  next.set("name", formString(form, "name"));
  next.set("phone", formString(form, "phone"));
  next.set("email", formString(form, "email"));
  next.set("message", catalogSignupMessage(label));
  next.set("Source", "sbd_catalog");
  next.set("Job", projectId);
  for (const key of AD_KEYS) {
    const value = formString(form, key).trim();
    if (value) next.set(key, value);
  }
  const lead = await (deps.handleLead ?? handleLeadFormData)(next, request);
  const body = (await lead.json()) as Record<string, unknown>;
  if (body.ok === true && body.discarded !== true) {
    return Response.json({ ...body, redirectUrl: deps.catalogUrl ?? catalogRedirectUrl() }, { status: lead.status });
  }
  return Response.json(body, { status: lead.status });
}
