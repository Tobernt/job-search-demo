import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { queryDatabase } from "./db";
import { labelToSlug } from "./slugs";
import type { BillingMode, MonetizationProductType } from "./monetization";
import type { EmploymentExtent, Job, WorkMode } from "./types";

export type ApprovalStatus = "pending" | "approved" | "paused" | "rejected" | "expired";
export type PaidOrderStatus = "pending" | "paid_pending_review" | "active" | "failed" | "canceled" | "refunded";
export type MonetizationRecordKind =
  | "sponsor"
  | "paid_job"
  | "employer_profile"
  | "employer_report"
  | "newsletter_sponsorship"
  | "affiliate";

export interface PaidOrder {
  id: string;
  productSku: string;
  productType: MonetizationProductType | "unknown";
  billingMode: BillingMode | "unknown";
  amountTotal?: number;
  currency: string;
  status: PaidOrderStatus;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  stripePaymentLinkId?: string;
  currentPeriodEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSponsorCampaign {
  id: string;
  label: "Annons" | "Sponsrad";
  category: string;
  placement: "top_search" | "empty_state";
  headline: string;
  body: string;
  cta: string;
  destinationUrl: string;
  disclosure: string;
  activeFrom: string;
  activeTo: string;
  priority: number;
  allowedContexts: {
    categories?: string[];
    workModes?: Array<WorkMode | "all">;
    locations?: string[];
  };
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaidJobPost {
  id: string;
  title: string;
  employerName: string;
  employerProfileSlug?: string;
  municipality: string;
  region?: string;
  country: string;
  employmentExtent: EmploymentExtent;
  employmentTypeText: string;
  workMode: WorkMode;
  salaryText: string;
  plainSummary: string;
  descriptionText: string;
  applyUrl: string;
  applyDomain: string;
  applicationDeadline?: string;
  publicationDate?: string;
  status: ApprovalStatus;
  approvedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerProfile {
  slug: string;
  employerName: string;
  organizationNumber?: string;
  websiteUrl?: string;
  logoUrl?: string;
  summary: string;
  specialties: string[];
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerQualityReport {
  id: string;
  employerName: string;
  employerDomain?: string;
  status: ApprovalStatus | "generated" | "delivered";
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  findings: Record<string, unknown>;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterSponsorship {
  id: string;
  headline: string;
  body: string;
  cta: string;
  destinationUrl: string;
  campaignDate?: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateCampaign {
  id: string;
  label: string;
  category: string;
  placement: string;
  headline: string;
  body: string;
  cta: string;
  destinationUrl: string;
  disclosure: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MonetizationEvent {
  id?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const monetizationDir = path.join(process.cwd(), "data", "monetization");
const jsonFiles = {
  paidOrders: "paid-orders.json",
  sponsorCampaigns: "sponsor-campaigns.json",
  paidJobPosts: "paid-job-posts.json",
  employerProfiles: "employer-profiles.json",
  employerQualityReports: "employer-quality-reports.json",
  newsletterSponsorships: "newsletter-sponsorships.json",
  affiliateCampaigns: "affiliate-campaigns.json",
  monetizationEvents: "monetization-events.json"
};

export async function listPaidOrders() {
  const rows = await queryDatabase<PaidOrder>(`
    select
      id,
      product_sku as "productSku",
      product_type as "productType",
      billing_mode as "billingMode",
      amount_total as "amountTotal",
      currency,
      status,
      stripe_checkout_session_id as "stripeCheckoutSessionId",
      stripe_payment_intent_id as "stripePaymentIntentId",
      stripe_subscription_id as "stripeSubscriptionId",
      stripe_payment_link_id as "stripePaymentLinkId",
      current_period_end as "currentPeriodEnd",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paid_orders
    order by created_at desc
    limit 200
  `);
  if (rows) return rows.map(normalizePaidOrder);
  return (await readJsonList<PaidOrder>(jsonFiles.paidOrders)).map(normalizePaidOrder);
}

export async function upsertPaidOrder(input: Partial<PaidOrder> & { productSku: string }) {
  const now = new Date().toISOString();
  const id = input.id
    || input.stripeCheckoutSessionId
    || input.stripeSubscriptionId
    || input.stripePaymentIntentId
    || randomUUID();
  const order: PaidOrder = {
    id,
    productSku: input.productSku,
    productType: input.productType ?? "unknown",
    billingMode: input.billingMode ?? "unknown",
    amountTotal: input.amountTotal,
    currency: (input.currency ?? "sek").toLowerCase(),
    status: input.status ?? "pending",
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePaymentLinkId: input.stripePaymentLinkId,
    currentPeriodEnd: input.currentPeriodEnd,
    createdAt: input.createdAt ?? now,
    updatedAt: now
  };

  const rows = await queryDatabase<PaidOrder>(`
    insert into paid_orders (
      id, product_sku, product_type, billing_mode, amount_total, currency, status,
      stripe_checkout_session_id, stripe_payment_intent_id, stripe_subscription_id,
      stripe_payment_link_id, current_period_end, created_at, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    on conflict (id) do update set
      product_sku = excluded.product_sku,
      product_type = excluded.product_type,
      billing_mode = excluded.billing_mode,
      amount_total = excluded.amount_total,
      currency = excluded.currency,
      status = excluded.status,
      stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, paid_orders.stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, paid_orders.stripe_payment_intent_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, paid_orders.stripe_subscription_id),
      stripe_payment_link_id = coalesce(excluded.stripe_payment_link_id, paid_orders.stripe_payment_link_id),
      current_period_end = coalesce(excluded.current_period_end, paid_orders.current_period_end),
      updated_at = excluded.updated_at
    returning
      id,
      product_sku as "productSku",
      product_type as "productType",
      billing_mode as "billingMode",
      amount_total as "amountTotal",
      currency,
      status,
      stripe_checkout_session_id as "stripeCheckoutSessionId",
      stripe_payment_intent_id as "stripePaymentIntentId",
      stripe_subscription_id as "stripeSubscriptionId",
      stripe_payment_link_id as "stripePaymentLinkId",
      current_period_end as "currentPeriodEnd",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `, [
    order.id,
    order.productSku,
    order.productType,
    order.billingMode,
    order.amountTotal ?? null,
    order.currency,
    order.status,
    order.stripeCheckoutSessionId ?? null,
    order.stripePaymentIntentId ?? null,
    order.stripeSubscriptionId ?? null,
    order.stripePaymentLinkId ?? null,
    order.currentPeriodEnd ?? null,
    order.createdAt,
    order.updatedAt
  ]);

  if (rows?.[0]) return normalizePaidOrder(rows[0]);
  const saved = await upsertJsonRecord(jsonFiles.paidOrders, order, (item) => item.id === order.id);
  return normalizePaidOrder(saved);
}

export async function updatePaidOrderBySubscription(stripeSubscriptionId: string, status: PaidOrderStatus, currentPeriodEnd?: string) {
  if (!stripeSubscriptionId) return;

  const rows = await queryDatabase<PaidOrder>(`
    update paid_orders
    set status = $2,
      current_period_end = coalesce($3, current_period_end),
      updated_at = now()
    where stripe_subscription_id = $1
    returning
      id,
      product_sku as "productSku",
      product_type as "productType",
      billing_mode as "billingMode",
      amount_total as "amountTotal",
      currency,
      status,
      stripe_checkout_session_id as "stripeCheckoutSessionId",
      stripe_payment_intent_id as "stripePaymentIntentId",
      stripe_subscription_id as "stripeSubscriptionId",
      stripe_payment_link_id as "stripePaymentLinkId",
      current_period_end as "currentPeriodEnd",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `, [stripeSubscriptionId, status, currentPeriodEnd ?? null]);
  if (rows) return rows.map(normalizePaidOrder);

  const orders = await readJsonList<PaidOrder>(jsonFiles.paidOrders);
  const now = new Date().toISOString();
  const updated = orders.map((order) =>
    order.stripeSubscriptionId === stripeSubscriptionId
      ? normalizePaidOrder({ ...order, status, currentPeriodEnd: currentPeriodEnd ?? order.currentPeriodEnd, updatedAt: now })
      : order
  );
  await writeJsonList(jsonFiles.paidOrders, updated);
  return updated.filter((order) => order.stripeSubscriptionId === stripeSubscriptionId);
}

export async function updatePaidOrderByPaymentIntent(stripePaymentIntentId: string, status: PaidOrderStatus) {
  if (!stripePaymentIntentId) return;

  const rows = await queryDatabase<PaidOrder>(`
    update paid_orders
    set status = $2,
      updated_at = now()
    where stripe_payment_intent_id = $1
    returning
      id,
      product_sku as "productSku",
      product_type as "productType",
      billing_mode as "billingMode",
      amount_total as "amountTotal",
      currency,
      status,
      stripe_checkout_session_id as "stripeCheckoutSessionId",
      stripe_payment_intent_id as "stripePaymentIntentId",
      stripe_subscription_id as "stripeSubscriptionId",
      stripe_payment_link_id as "stripePaymentLinkId",
      current_period_end as "currentPeriodEnd",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `, [stripePaymentIntentId, status]);
  if (rows) return rows.map(normalizePaidOrder);

  const orders = await readJsonList<PaidOrder>(jsonFiles.paidOrders);
  const now = new Date().toISOString();
  const updated = orders.map((order) =>
    order.stripePaymentIntentId === stripePaymentIntentId
      ? normalizePaidOrder({ ...order, status, updatedAt: now })
      : order
  );
  await writeJsonList(jsonFiles.paidOrders, updated);
  return updated.filter((order) => order.stripePaymentIntentId === stripePaymentIntentId);
}

export async function listSponsorCampaigns() {
  const rows = await queryDatabase<PublicSponsorCampaign>(`
    select
      id,
      label,
      category,
      placement,
      headline,
      body,
      cta,
      destination_url as "destinationUrl",
      disclosure,
      active_from as "activeFrom",
      active_to as "activeTo",
      priority,
      allowed_contexts as "allowedContexts",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from sponsor_campaigns
    order by priority desc, created_at desc
  `);
  if (rows) return rows.map(normalizeSponsorCampaign);
  return (await readJsonList<PublicSponsorCampaign>(jsonFiles.sponsorCampaigns)).map(normalizeSponsorCampaign);
}

export async function getApprovedSponsorCampaigns() {
  const now = new Date();
  return (await listSponsorCampaigns()).filter((campaign) =>
    campaign.status === "approved"
    && parseDate(campaign.activeFrom) <= now
    && now <= parseDate(campaign.activeTo)
  );
}

export async function getSponsorCampaignById(id: string) {
  return (await listSponsorCampaigns()).find((campaign) => campaign.id === id);
}

export async function upsertSponsorCampaign(input: Omit<PublicSponsorCampaign, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
  const record = normalizeSponsorCampaign(withTimestamps(input));
  const rows = await queryDatabase<PublicSponsorCampaign>(`
    insert into sponsor_campaigns (
      id, label, category, placement, headline, body, cta, destination_url,
      disclosure, active_from, active_to, priority, allowed_contexts, status, created_at, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16)
    on conflict (id) do update set
      label = excluded.label,
      category = excluded.category,
      placement = excluded.placement,
      headline = excluded.headline,
      body = excluded.body,
      cta = excluded.cta,
      destination_url = excluded.destination_url,
      disclosure = excluded.disclosure,
      active_from = excluded.active_from,
      active_to = excluded.active_to,
      priority = excluded.priority,
      allowed_contexts = excluded.allowed_contexts,
      status = excluded.status,
      updated_at = excluded.updated_at
    returning
      id, label, category, placement, headline, body, cta,
      destination_url as "destinationUrl",
      disclosure,
      active_from as "activeFrom",
      active_to as "activeTo",
      priority,
      allowed_contexts as "allowedContexts",
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `, [
    record.id,
    record.label,
    record.category,
    record.placement,
    record.headline,
    record.body,
    record.cta,
    record.destinationUrl,
    record.disclosure,
    record.activeFrom,
    record.activeTo,
    record.priority,
    JSON.stringify(record.allowedContexts),
    record.status,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizeSponsorCampaign(rows[0]);
  return upsertJsonRecord(jsonFiles.sponsorCampaigns, record, (item) => item.id === record.id);
}

export async function listPaidJobPosts() {
  const rows = await queryDatabase<PaidJobPost>(`
    select
      id,
      title,
      employer_name as "employerName",
      employer_profile_slug as "employerProfileSlug",
      municipality,
      region,
      country,
      employment_extent as "employmentExtent",
      employment_type_text as "employmentTypeText",
      work_mode as "workMode",
      salary_text as "salaryText",
      plain_summary as "plainSummary",
      description_text as "descriptionText",
      apply_url as "applyUrl",
      apply_domain as "applyDomain",
      application_deadline as "applicationDeadline",
      publication_date as "publicationDate",
      status,
      approved_at as "approvedAt",
      expires_at as "expiresAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from paid_job_posts
    order by created_at desc
  `);
  if (rows) return rows.map(normalizePaidJobPost);
  return (await readJsonList<PaidJobPost>(jsonFiles.paidJobPosts)).map(normalizePaidJobPost);
}

export async function upsertPaidJobPost(input: Omit<PaidJobPost, "createdAt" | "updatedAt" | "applyDomain"> & { applyDomain?: string; createdAt?: string; updatedAt?: string }) {
  const record = normalizePaidJobPost(withTimestamps({
    ...input,
    applyDomain: input.applyDomain || domainFromUrl(input.applyUrl)
  }));
  if (!record.applyDomain) {
    throw new Error("Paid job posts require a valid external apply URL.");
  }

  const rows = await queryDatabase<PaidJobPost>(`
    insert into paid_job_posts (
      id, title, employer_name, employer_profile_slug, municipality, region, country,
      employment_extent, employment_type_text, work_mode, salary_text, plain_summary,
      description_text, apply_url, apply_domain, application_deadline, publication_date,
      status, approved_at, expires_at, created_at, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    on conflict (id) do update set
      title = excluded.title,
      employer_name = excluded.employer_name,
      employer_profile_slug = excluded.employer_profile_slug,
      municipality = excluded.municipality,
      region = excluded.region,
      country = excluded.country,
      employment_extent = excluded.employment_extent,
      employment_type_text = excluded.employment_type_text,
      work_mode = excluded.work_mode,
      salary_text = excluded.salary_text,
      plain_summary = excluded.plain_summary,
      description_text = excluded.description_text,
      apply_url = excluded.apply_url,
      apply_domain = excluded.apply_domain,
      application_deadline = excluded.application_deadline,
      publication_date = excluded.publication_date,
      status = excluded.status,
      approved_at = excluded.approved_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
    returning
      id, title, employer_name as "employerName", employer_profile_slug as "employerProfileSlug",
      municipality, region, country, employment_extent as "employmentExtent",
      employment_type_text as "employmentTypeText", work_mode as "workMode",
      salary_text as "salaryText", plain_summary as "plainSummary",
      description_text as "descriptionText", apply_url as "applyUrl",
      apply_domain as "applyDomain", application_deadline as "applicationDeadline",
      publication_date as "publicationDate", status, approved_at as "approvedAt",
      expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
  `, [
    record.id,
    record.title,
    record.employerName,
    record.employerProfileSlug ?? null,
    record.municipality,
    record.region ?? null,
    record.country,
    record.employmentExtent,
    record.employmentTypeText,
    record.workMode,
    record.salaryText,
    record.plainSummary,
    record.descriptionText,
    record.applyUrl,
    record.applyDomain,
    record.applicationDeadline ?? null,
    record.publicationDate ?? null,
    record.status,
    record.approvedAt ?? null,
    record.expiresAt ?? null,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizePaidJobPost(rows[0]);
  return upsertJsonRecord(jsonFiles.paidJobPosts, record, (item) => item.id === record.id);
}

export async function getApprovedPaidJobsAsJobs(): Promise<Job[]> {
  const posts = await listPaidJobPosts();
  const now = new Date();
  const profiles = await listEmployerProfiles();
  const profilesBySlug = new Map(profiles.filter((profile) => profile.status === "approved").map((profile) => [profile.slug, profile]));

  return posts
    .filter((post) => post.status === "approved")
    .filter((post) => !post.expiresAt || parseDate(post.expiresAt) >= now)
    .filter((post) => !post.applicationDeadline || parseDate(post.applicationDeadline) >= now)
    .map((post) => paidPostToJob(post, profilesBySlug.get(post.employerProfileSlug ?? labelToSlug(post.employerName))));
}

export async function listEmployerProfiles() {
  const rows = await queryDatabase<EmployerProfile>(`
    select
      slug,
      employer_name as "employerName",
      organization_number as "organizationNumber",
      website_url as "websiteUrl",
      logo_url as "logoUrl",
      summary,
      specialties,
      status,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from employer_profiles
    order by employer_name asc
  `);
  if (rows) return rows.map(normalizeEmployerProfile);
  return (await readJsonList<EmployerProfile>(jsonFiles.employerProfiles)).map(normalizeEmployerProfile);
}

export async function getApprovedEmployerProfile(slug: string) {
  return (await listEmployerProfiles()).find((profile) => profile.slug === slug && profile.status === "approved");
}

export async function findApprovedEmployerProfileForJob(job: Pick<Job, "employerName">) {
  return getApprovedEmployerProfile(labelToSlug(job.employerName));
}

export async function upsertEmployerProfile(input: Omit<EmployerProfile, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
  const record = normalizeEmployerProfile(withTimestamps(input));
  const rows = await queryDatabase<EmployerProfile>(`
    insert into employer_profiles (
      slug, employer_name, organization_number, website_url, logo_url, summary, specialties, status, created_at, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    on conflict (slug) do update set
      employer_name = excluded.employer_name,
      organization_number = excluded.organization_number,
      website_url = excluded.website_url,
      logo_url = excluded.logo_url,
      summary = excluded.summary,
      specialties = excluded.specialties,
      status = excluded.status,
      updated_at = excluded.updated_at
    returning
      slug, employer_name as "employerName", organization_number as "organizationNumber",
      website_url as "websiteUrl", logo_url as "logoUrl", summary, specialties, status,
      created_at as "createdAt", updated_at as "updatedAt"
  `, [
    record.slug,
    record.employerName,
    record.organizationNumber ?? null,
    record.websiteUrl ?? null,
    record.logoUrl ?? null,
    record.summary,
    JSON.stringify(record.specialties),
    record.status,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizeEmployerProfile(rows[0]);
  return upsertJsonRecord(jsonFiles.employerProfiles, record, (item) => item.slug === record.slug);
}

export async function listEmployerQualityReports() {
  const rows = await queryDatabase<EmployerQualityReport>(`
    select
      id,
      employer_name as "employerName",
      employer_domain as "employerDomain",
      status,
      report_period_start as "reportPeriodStart",
      report_period_end as "reportPeriodEnd",
      findings,
      generated_at as "generatedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from employer_quality_reports
    order by created_at desc
  `);
  if (rows) return rows.map(normalizeEmployerQualityReport);
  return (await readJsonList<EmployerQualityReport>(jsonFiles.employerQualityReports)).map(normalizeEmployerQualityReport);
}

export async function upsertEmployerQualityReport(input: Omit<EmployerQualityReport, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
  const record = normalizeEmployerQualityReport(withTimestamps(input));
  const rows = await queryDatabase<EmployerQualityReport>(`
    insert into employer_quality_reports (
      id, employer_name, employer_domain, status, report_period_start,
      report_period_end, findings, generated_at, created_at, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    on conflict (id) do update set
      employer_name = excluded.employer_name,
      employer_domain = excluded.employer_domain,
      status = excluded.status,
      report_period_start = excluded.report_period_start,
      report_period_end = excluded.report_period_end,
      findings = excluded.findings,
      generated_at = excluded.generated_at,
      updated_at = excluded.updated_at
    returning
      id, employer_name as "employerName", employer_domain as "employerDomain",
      status, report_period_start as "reportPeriodStart", report_period_end as "reportPeriodEnd",
      findings, generated_at as "generatedAt", created_at as "createdAt", updated_at as "updatedAt"
  `, [
    record.id,
    record.employerName,
    record.employerDomain ?? null,
    record.status,
    record.reportPeriodStart ?? null,
    record.reportPeriodEnd ?? null,
    JSON.stringify(record.findings),
    record.generatedAt ?? null,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizeEmployerQualityReport(rows[0]);
  return upsertJsonRecord(jsonFiles.employerQualityReports, record, (item) => item.id === record.id);
}

export async function listNewsletterSponsorships() {
  const rows = await queryDatabase<NewsletterSponsorship>(`
    select
      id, headline, body, cta, destination_url as "destinationUrl",
      campaign_date as "campaignDate", status, created_at as "createdAt", updated_at as "updatedAt"
    from newsletter_sponsorships
    order by campaign_date desc nulls last, created_at desc
  `);
  if (rows) return rows.map(normalizeNewsletterSponsorship);
  return (await readJsonList<NewsletterSponsorship>(jsonFiles.newsletterSponsorships)).map(normalizeNewsletterSponsorship);
}

export async function upsertNewsletterSponsorship(input: Omit<NewsletterSponsorship, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
  const record = normalizeNewsletterSponsorship(withTimestamps(input));
  const rows = await queryDatabase<NewsletterSponsorship>(`
    insert into newsletter_sponsorships (id, headline, body, cta, destination_url, campaign_date, status, created_at, updated_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    on conflict (id) do update set
      headline = excluded.headline,
      body = excluded.body,
      cta = excluded.cta,
      destination_url = excluded.destination_url,
      campaign_date = excluded.campaign_date,
      status = excluded.status,
      updated_at = excluded.updated_at
    returning
      id, headline, body, cta, destination_url as "destinationUrl",
      campaign_date as "campaignDate", status, created_at as "createdAt", updated_at as "updatedAt"
  `, [
    record.id,
    record.headline,
    record.body,
    record.cta,
    record.destinationUrl,
    record.campaignDate ?? null,
    record.status,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizeNewsletterSponsorship(rows[0]);
  return upsertJsonRecord(jsonFiles.newsletterSponsorships, record, (item) => item.id === record.id);
}

export async function listAffiliateCampaigns() {
  const rows = await queryDatabase<AffiliateCampaign>(`
    select
      id, label, category, placement, headline, body, cta,
      destination_url as "destinationUrl", disclosure, status,
      created_at as "createdAt", updated_at as "updatedAt"
    from affiliate_campaigns
    order by created_at desc
  `);
  if (rows) return rows.map(normalizeAffiliateCampaign);
  return (await readJsonList<AffiliateCampaign>(jsonFiles.affiliateCampaigns)).map(normalizeAffiliateCampaign);
}

export async function getAffiliateCampaignById(id: string) {
  return (await listAffiliateCampaigns()).find((campaign) => campaign.id === id);
}

export async function upsertAffiliateCampaign(input: Omit<AffiliateCampaign, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }) {
  const record = normalizeAffiliateCampaign(withTimestamps(input));
  const rows = await queryDatabase<AffiliateCampaign>(`
    insert into affiliate_campaigns (id, label, category, placement, headline, body, cta, destination_url, disclosure, status, created_at, updated_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    on conflict (id) do update set
      label = excluded.label,
      category = excluded.category,
      placement = excluded.placement,
      headline = excluded.headline,
      body = excluded.body,
      cta = excluded.cta,
      destination_url = excluded.destination_url,
      disclosure = excluded.disclosure,
      status = excluded.status,
      updated_at = excluded.updated_at
    returning
      id, label, category, placement, headline, body, cta,
      destination_url as "destinationUrl", disclosure, status,
      created_at as "createdAt", updated_at as "updatedAt"
  `, [
    record.id,
    record.label,
    record.category,
    record.placement,
    record.headline,
    record.body,
    record.cta,
    record.destinationUrl,
    record.disclosure,
    record.status,
    record.createdAt,
    record.updatedAt
  ]);
  if (rows?.[0]) return normalizeAffiliateCampaign(rows[0]);
  return upsertJsonRecord(jsonFiles.affiliateCampaigns, record, (item) => item.id === record.id);
}

export async function listMonetizationEvents() {
  const rows = await queryDatabase<MonetizationEvent>(`
    select
      id::text,
      event_type as "eventType",
      entity_type as "entityType",
      entity_id as "entityId",
      source,
      metadata,
      created_at as "createdAt"
    from monetization_events
    order by created_at desc
    limit 200
  `);
  if (rows) return rows.map(normalizeMonetizationEvent);
  return (await readJsonList<MonetizationEvent>(jsonFiles.monetizationEvents)).map(normalizeMonetizationEvent);
}

export async function recordMonetizationEvent(input: Omit<MonetizationEvent, "createdAt"> & { createdAt?: string }) {
  const event = normalizeMonetizationEvent({ ...input, createdAt: input.createdAt ?? new Date().toISOString() });
  const rows = await queryDatabase<MonetizationEvent>(`
    insert into monetization_events (event_type, entity_type, entity_id, source, metadata)
    values ($1, $2, $3, $4, $5::jsonb)
    returning
      id::text,
      event_type as "eventType",
      entity_type as "entityType",
      entity_id as "entityId",
      source,
      metadata,
      created_at as "createdAt"
  `, [
    event.eventType,
    event.entityType ?? null,
    event.entityId ?? null,
    event.source ?? null,
    JSON.stringify(event.metadata)
  ]);
  if (rows?.[0]) return normalizeMonetizationEvent(rows[0]);
  return upsertJsonRecord(jsonFiles.monetizationEvents, { ...event, id: event.id ?? randomUUID() }, (item) => item.id === event.id);
}

export async function updateMonetizationStatus(kind: MonetizationRecordKind, id: string, status: ApprovalStatus | "generated" | "delivered") {
  const table = tableForKind(kind);
  const idColumn = kind === "employer_profile" ? "slug" : "id";
  const rows = await queryDatabase<{ id: string }>(`
    update ${table}
    set status = $2, updated_at = now()
    where ${idColumn} = $1
    returning ${idColumn} as id
  `, [id, status]);
  if (rows) {
    await recordMonetizationEvent({
      eventType: "status_updated",
      entityType: kind,
      entityId: id,
      source: "admin",
      metadata: { status }
    });
    return rows.length > 0;
  }

  const file = fileForKind(kind);
  const items = await readJsonList<Record<string, unknown>>(file);
  const key = kind === "employer_profile" ? "slug" : "id";
  let changed = false;
  const updated = items.map((item) => {
    if (item[key] !== id) return item;
    changed = true;
    return { ...item, status, updatedAt: new Date().toISOString() };
  });
  if (changed) {
    await writeJsonList(file, updated);
    await recordMonetizationEvent({
      eventType: "status_updated",
      entityType: kind,
      entityId: id,
      source: "admin",
      metadata: { status }
    });
  }
  return changed;
}

export async function monetizationDashboardData() {
  const [
    paidOrders,
    sponsorCampaigns,
    paidJobPosts,
    employerProfiles,
    employerQualityReports,
    newsletterSponsorships,
    affiliateCampaigns,
    monetizationEvents
  ] = await Promise.all([
    listPaidOrders(),
    listSponsorCampaigns(),
    listPaidJobPosts(),
    listEmployerProfiles(),
    listEmployerQualityReports(),
    listNewsletterSponsorships(),
    listAffiliateCampaigns(),
    listMonetizationEvents()
  ]);

  return {
    paidOrders,
    sponsorCampaigns,
    paidJobPosts,
    employerProfiles,
    employerQualityReports,
    newsletterSponsorships,
    affiliateCampaigns,
    monetizationEvents
  };
}

function paidPostToJob(post: PaidJobPost, profile?: EmployerProfile): Job {
  const now = new Date().toISOString();
  const publicationDate = post.publicationDate || post.approvedAt || post.createdAt;
  const id = `paid-${post.id}`;

  return {
    id,
    source: "paid_direct",
    sourceAdId: post.id,
    sourceUrl: "",
    logoUrl: profile?.logoUrl,
    title: post.title,
    titleNormalized: post.title.toLowerCase(),
    titleCanonical: post.title,
    titleCategory: "Direktjobb",
    employerName: post.employerName,
    employerOrganizationNumber: undefined,
    workplaceName: post.employerName,
    workplaceAddress: undefined,
    municipality: post.municipality,
    region: post.region || post.municipality,
    country: post.country || "Sverige",
    publicationDate,
    applicationDeadline: post.applicationDeadline,
    status: "live",
    employerType: "direct_employer",
    employmentExtent: post.employmentExtent,
    employmentTypeText: post.employmentTypeText || "Ej angivet",
    salesNoise: false,
    workMode: post.workMode,
    workModeConfidence: post.workMode === "unclear" ? 0.4 : 1,
    seniority: "unclear",
    salaryText: post.salaryText || "Lön ej angiven",
    languageLabels: ["Ej angivet"],
    mustHaveSummary: [],
    niceToHaveSummary: [],
    plainSummary: post.plainSummary,
    descriptionText: post.descriptionText,
    applyUrl: post.applyUrl,
    applyDomain: post.applyDomain,
    applyType: "employer_site",
    applyLinkStatus: "unchecked",
    employerVerified: true,
    employerVerificationReason: "Betald direktannons granskad före publicering. Ansökan hanteras externt.",
    trustScore: 70,
    canonicalFingerprint: `paid:${post.id}`,
    duplicateCount: 0,
    lastCheckedAt: now,
    firstSeenAt: publicationDate,
    updatedAt: post.updatedAt,
    classificationVersion: "paid-direct-v1"
  };
}

function normalizePaidOrder(order: PaidOrder): PaidOrder {
  return {
    ...order,
    currency: (order.currency || "sek").toLowerCase(),
    status: normalizePaidOrderStatus(order.status),
    createdAt: iso(order.createdAt),
    updatedAt: iso(order.updatedAt),
    currentPeriodEnd: optionalIso(order.currentPeriodEnd)
  };
}

function normalizeSponsorCampaign(campaign: PublicSponsorCampaign): PublicSponsorCampaign {
  return {
    ...campaign,
    id: slugId(campaign.id || campaign.headline),
    label: campaign.label === "Annons" ? "Annons" : "Sponsrad",
    placement: campaign.placement === "empty_state" ? "empty_state" : "top_search",
    activeFrom: iso(campaign.activeFrom),
    activeTo: iso(campaign.activeTo),
    priority: Number(campaign.priority ?? 0),
    allowedContexts: normalizeAllowedContexts(campaign.allowedContexts),
    status: normalizeApprovalStatus(campaign.status),
    createdAt: iso(campaign.createdAt),
    updatedAt: iso(campaign.updatedAt)
  };
}

function normalizePaidJobPost(post: PaidJobPost): PaidJobPost {
  return {
    ...post,
    id: slugId(post.id || `${post.employerName}-${post.title}`),
    employerProfileSlug: post.employerProfileSlug || labelToSlug(post.employerName),
    country: post.country || "Sverige",
    employmentExtent: normalizeEmploymentExtent(post.employmentExtent),
    employmentTypeText: post.employmentTypeText || "Ej angivet",
    workMode: normalizeWorkMode(post.workMode),
    salaryText: post.salaryText || "Lön ej angiven",
    applyDomain: post.applyDomain || domainFromUrl(post.applyUrl),
    applicationDeadline: optionalIso(post.applicationDeadline),
    publicationDate: optionalIso(post.publicationDate),
    approvedAt: optionalIso(post.approvedAt),
    expiresAt: optionalIso(post.expiresAt),
    status: normalizeApprovalStatus(post.status),
    createdAt: iso(post.createdAt),
    updatedAt: iso(post.updatedAt)
  };
}

function normalizeEmployerProfile(profile: EmployerProfile): EmployerProfile {
  return {
    ...profile,
    slug: labelToSlug(profile.slug || profile.employerName),
    specialties: normalizeStringArray(profile.specialties),
    status: normalizeApprovalStatus(profile.status),
    createdAt: iso(profile.createdAt),
    updatedAt: iso(profile.updatedAt)
  };
}

function normalizeEmployerQualityReport(report: EmployerQualityReport): EmployerQualityReport {
  return {
    ...report,
    id: slugId(report.id || report.employerName),
    findings: normalizeObject(report.findings),
    reportPeriodStart: optionalIso(report.reportPeriodStart),
    reportPeriodEnd: optionalIso(report.reportPeriodEnd),
    generatedAt: optionalIso(report.generatedAt),
    createdAt: iso(report.createdAt),
    updatedAt: iso(report.updatedAt)
  };
}

function normalizeNewsletterSponsorship(record: NewsletterSponsorship): NewsletterSponsorship {
  return {
    ...record,
    id: slugId(record.id || record.headline),
    campaignDate: optionalDate(record.campaignDate),
    status: normalizeApprovalStatus(record.status),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt)
  };
}

function normalizeAffiliateCampaign(record: AffiliateCampaign): AffiliateCampaign {
  return {
    ...record,
    id: slugId(record.id || record.headline),
    status: normalizeApprovalStatus(record.status),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt)
  };
}

function normalizeMonetizationEvent(event: MonetizationEvent): MonetizationEvent {
  return {
    ...event,
    metadata: normalizeObject(event.metadata),
    createdAt: iso(event.createdAt)
  };
}

function withTimestamps<T extends { createdAt?: string; updatedAt?: string }>(record: T) {
  const now = new Date().toISOString();
  return {
    ...record,
    createdAt: record.createdAt ?? now,
    updatedAt: now
  };
}

async function readJsonList<T>(fileName: string): Promise<T[]> {
  try {
    const raw = await readFile(path.join(monetizationDir, fileName), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

async function writeJsonList<T>(fileName: string, items: T[]) {
  await mkdir(monetizationDir, { recursive: true });
  await writeFile(path.join(monetizationDir, fileName), `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function upsertJsonRecord<T>(fileName: string, record: T, match: (item: T) => boolean) {
  const items = await readJsonList<T>(fileName);
  const index = items.findIndex(match);
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  await writeJsonList(fileName, items);
  return record;
}

function tableForKind(kind: MonetizationRecordKind) {
  return {
    sponsor: "sponsor_campaigns",
    paid_job: "paid_job_posts",
    employer_profile: "employer_profiles",
    employer_report: "employer_quality_reports",
    newsletter_sponsorship: "newsletter_sponsorships",
    affiliate: "affiliate_campaigns"
  }[kind];
}

function fileForKind(kind: MonetizationRecordKind) {
  return {
    sponsor: jsonFiles.sponsorCampaigns,
    paid_job: jsonFiles.paidJobPosts,
    employer_profile: jsonFiles.employerProfiles,
    employer_report: jsonFiles.employerQualityReports,
    newsletter_sponsorship: jsonFiles.newsletterSponsorships,
    affiliate: jsonFiles.affiliateCampaigns
  }[kind];
}

function normalizeApprovalStatus(value: unknown): ApprovalStatus {
  if (value === "approved" || value === "paused" || value === "rejected" || value === "expired") return value;
  return "pending";
}

function normalizePaidOrderStatus(value: unknown): PaidOrderStatus {
  if (value === "paid_pending_review" || value === "active" || value === "failed" || value === "canceled" || value === "refunded") return value;
  return "pending";
}

function normalizeEmploymentExtent(value: unknown): EmploymentExtent {
  if (value === "full_time" || value === "part_time" || value === "mixed") return value;
  return "unclear";
}

function normalizeWorkMode(value: unknown): WorkMode {
  if (value === "remote" || value === "hybrid" || value === "onsite") return value;
  return "unclear";
}

function normalizeAllowedContexts(value: unknown): PublicSponsorCampaign["allowedContexts"] {
  const object = normalizeObject(value);
  return {
    categories: normalizeStringArray(object.categories),
    workModes: normalizeStringArray(object.workModes).filter((item) =>
      item === "remote" || item === "hybrid" || item === "onsite" || item === "unclear" || item === "all"
    ) as Array<WorkMode | "all">,
    locations: normalizeStringArray(object.locations)
  };
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function slugId(value: string) {
  return labelToSlug(value || randomUUID()) || randomUUID();
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function iso(value: unknown) {
  const date = parseDate(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function optionalIso(value: unknown) {
  if (!value) return undefined;
  const date = parseDate(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function optionalDate(value: unknown) {
  const isoValue = optionalIso(value);
  return isoValue?.slice(0, 10);
}

function parseDate(value: unknown) {
  if (value instanceof Date) return value;
  return new Date(String(value ?? ""));
}
