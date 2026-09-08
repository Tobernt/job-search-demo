import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAvailableProductBySku, isPassiveProduct, monetizationProducts, type MonetizationProduct } from "@/lib/monetization";
import {
  recordMonetizationEvent,
  upsertAffiliateCampaign,
  upsertSponsorCampaign
} from "@/lib/monetization-store";
import { labelToSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

type Answers = Map<string, string>;

export async function POST(request: NextRequest) {
  if (process.env.FILLOUT_WEBHOOK_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "Fillout webhook is disabled." }, { status: 503 });
  }

  const secret = process.env.FILLOUT_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Fillout webhook is not configured." }, { status: 503 });
  }

  if (!isAuthorized(request.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => undefined) as unknown;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const answers = extractAnswers(payload);
  const sku = findSku(answers);
  const product = sku ? getAvailableProductBySku(sku) : undefined;
  const submissionId = submissionIdFromPayload(payload, answers);

  if (!product || !isPassiveProduct(product)) {
    await recordRejectedIntake("paused_or_unknown_product", sku, submissionId, answers);
    return NextResponse.json({ ok: false, error: "Only passive sponsor and affiliate products are accepted." }, { status: 422 });
  }

  try {
    if (product.productType === "sponsor_slot") {
      const sponsor = await createSponsorFromAnswers(product, answers, submissionId);
      await recordAcceptedIntake("sponsor", sponsor.id, product, submissionId, answers);
      return NextResponse.json({ ok: true, kind: "sponsor", id: sponsor.id, status: sponsor.status });
    }

    if (product.productType === "affiliate_placement") {
      const affiliate = await createAffiliateFromAnswers(product, answers, submissionId);
      await recordAcceptedIntake("affiliate", affiliate.id, product, submissionId, answers);
      return NextResponse.json({ ok: true, kind: "affiliate", id: affiliate.id, status: affiliate.status });
    }
  } catch (error) {
    await recordRejectedIntake("invalid_passive_intake", sku, submissionId, answers);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid passive intake."
    }, { status: 400 });
  }

  await recordRejectedIntake("unsupported_passive_product", sku, submissionId, answers);
  return NextResponse.json({ ok: false, error: "Unsupported passive product." }, { status: 422 });
}

async function createSponsorFromAnswers(product: MonetizationProduct, answers: Answers, submissionId: string) {
  const headline = requiredText(answers, ["rubrik", "headline", "title"], 120);
  const category = text(answers, ["onskad kategori eller malgrupp", "kategori", "category", "targeting"], 80) || "all";
  const activeFrom = dateValue(text(answers, ["onskat startdatum", "startdatum", "active from", "activeFrom"], 80)) ?? new Date();
  const activeTo = addMonths(activeFrom, product.billingMode === "prepaid" ? 3 : 1);

  return upsertSponsorCampaign({
    id: stableRecordId(product.sku, submissionId, headline),
    label: labelValue(answers),
    category,
    placement: sponsorPlacement(answers),
    headline,
    body: requiredText(answers, ["text", "body", "beskrivning"], 280),
    cta: requiredText(answers, ["knapptext", "cta", "button text"], 60),
    destinationUrl: requiredUrl(answers, ["publik destinationslank", "destinationslank", "destination url", "destinationUrl", "url"]),
    disclosure: text(answers, ["markning", "disclosure"], 180) || "Sponsrad placering. Organiska jobbresultat påverkas inte.",
    activeFrom: activeFrom.toISOString(),
    activeTo: activeTo.toISOString(),
    priority: numberValue(text(answers, ["prioritet", "priority"], 20), 50),
    allowedContexts: {
      categories: category === "all" ? ["all"] : splitList(category),
      workModes: ["all"],
      locations: splitList(text(answers, ["platser", "locations", "kommuner"], 300))
    },
    status: "pending"
  });
}

async function createAffiliateFromAnswers(product: MonetizationProduct, answers: Answers, submissionId: string) {
  const headline = requiredText(answers, ["rubrik", "headline", "title"], 120);
  return upsertAffiliateCampaign({
    id: stableRecordId(product.sku, submissionId, headline),
    label: text(answers, ["markning", "label"], 80) || "Partner",
    category: text(answers, ["kategori", "category"], 80) || "career",
    placement: text(answers, ["placering", "placement"], 80) || "resource",
    headline,
    body: requiredText(answers, ["text", "body", "beskrivning"], 280),
    cta: requiredText(answers, ["knapptext", "cta", "button text"], 60),
    destinationUrl: requiredUrl(answers, ["publik destinationslank", "destinationslank", "destination url", "destinationUrl", "url"]),
    disclosure: text(answers, ["markning eller ersattningsmodell", "disclosure"], 180) || "Betald partnerlänk. Organiska jobbresultat påverkas inte.",
    status: "pending"
  });
}

function findSku(answers: Answers) {
  const explicit = text(answers, ["produkt", "product", "sku", "product sku", "product_sku", "productSku", "paket"], 120);
  if (!explicit) return "";
  const normalized = normalizeValue(explicit);
  return monetizationProducts.find((product) =>
    normalizeValue(product.sku) === normalized || normalizeValue(product.title) === normalized
  )?.sku ?? explicit;
}

function extractAnswers(payload: unknown) {
  const answers: Answers = new Map();
  visit(payload, "");
  return answers;

  function visit(value: unknown, parentKey: string) {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, parentKey);
      return;
    }
    if (typeof value !== "object") return;

    const object = value as Record<string, unknown>;
    const key = primitiveText(object.name)
      || primitiveText(object.label)
      || primitiveText(object.title)
      || primitiveText(object.question)
      || primitiveText(object.id)
      || parentKey;
    const answer = primitiveText(object.value)
      || primitiveText(object.answer)
      || primitiveText(object.response)
      || primitiveText(object.text);

    if (key && answer) answers.set(normalizeKey(key), answer);

    for (const [childKey, childValue] of Object.entries(object)) {
      if (childValue === object.value || childValue === object.answer || childValue === object.response) continue;
      if (isPrimitive(childValue)) {
        const childText = primitiveText(childValue);
        if (childText) answers.set(normalizeKey(childKey), childText);
      } else {
        visit(childValue, childKey);
      }
    }
  }
}

function text(answers: Answers, aliases: string[], maxLength: number) {
  for (const alias of aliases) {
    const value = answers.get(normalizeKey(alias));
    if (value) return cleanText(value, maxLength);
  }
  return "";
}

function requiredText(answers: Answers, aliases: string[], maxLength: number) {
  const value = text(answers, aliases, maxLength);
  if (!value) throw new Error(`${aliases[0]} is required.`);
  return value;
}

function requiredUrl(answers: Answers, aliases: string[]) {
  const value = requiredText(answers, aliases, 600);
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Destination URL must be http(s).");
  return url.toString();
}

function labelValue(answers: Answers): "Annons" | "Sponsrad" {
  const value = normalizeValue(text(answers, ["markning", "label"], 40));
  return value.includes("annons") ? "Annons" : "Sponsrad";
}

function sponsorPlacement(answers: Answers): "top_search" | "empty_state" {
  const value = normalizeValue(text(answers, ["onskad sponsorplats", "placement", "placering"], 80));
  return value.includes("tomt") || value.includes("empty") ? "empty_state" : "top_search";
}

function submissionIdFromPayload(payload: unknown, answers: Answers) {
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    const direct = primitiveText(object.submissionId)
      || primitiveText(object.submission_id)
      || primitiveText(object.responseId)
      || primitiveText(object.response_id);
    if (direct) return cleanText(direct, 120);
  }
  return text(answers, ["submission id", "submissionId", "response id"], 120);
}

function stableRecordId(sku: string, submissionId: string, headline: string) {
  return labelToSlug([sku, submissionId || headline].filter(Boolean).join("-"));
}

function dateValue(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function numberValue(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => cleanText(item, 80))
    .filter(Boolean);
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeKey(value: string) {
  return normalizeValue(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function primitiveText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isPrimitive(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isAuthorized(value: string, secret: string) {
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function recordAcceptedIntake(kind: string, id: string, product: MonetizationProduct, submissionId: string, answers: Answers) {
  await recordMonetizationEvent({
    eventType: "fillout_intake_received",
    entityType: kind,
    entityId: id,
    source: "fillout",
    metadata: {
      sku: product.sku,
      submissionId,
      status: "pending",
      fieldKeys: Array.from(answers.keys()).slice(0, 50)
    }
  });
}

async function recordRejectedIntake(reason: string, sku: string, submissionId: string, answers: Answers) {
  await recordMonetizationEvent({
    eventType: "fillout_intake_rejected",
    entityType: "fillout_submission",
    entityId: submissionId || undefined,
    source: "fillout",
    metadata: {
      reason,
      sku,
      fieldKeys: Array.from(answers.keys()).slice(0, 50)
    }
  });
}
