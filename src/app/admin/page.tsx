import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAdminAccess } from "@/lib/admin-auth";
import { buildEmployerQualityFindings } from "@/lib/employer-quality";
import { formatSek, productTypeLabel } from "@/lib/monetization";
import {
  monetizationDashboardData,
  updateMonetizationStatus,
  upsertAffiliateCampaign,
  upsertEmployerProfile,
  upsertEmployerQualityReport,
  upsertNewsletterSponsorship,
  upsertPaidJobPost,
  upsertSponsorCampaign,
  type ApprovalStatus,
  type MonetizationRecordKind
} from "@/lib/monetization-store";
import { labelToSlug } from "@/lib/slugs";
import type { EmploymentExtent, WorkMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  const access = await requireAdminAccess();
  const data = await monetizationDashboardData();
  const paidTotal = data.paidOrders
    .filter((order) => order.status === "paid_pending_review" || order.status === "active")
    .reduce((sum, order) => sum + Number(order.amountTotal ?? 0), 0);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Link href="/" className="back-link">Till sökningen</Link>
          <h1>Monetisering</h1>
          <p>Adminvy för icke-känsliga legacy-order, produkt- och publiceringsdata. Publik försäljning och externa intakeflöden är pausade.</p>
        </div>
        <div className="admin-auth-note">
          <ShieldCheck size={20} />
          <span>Åtkomst: {access.actor}</span>
        </div>
      </header>

      <section className="admin-metrics">
        <Metric title="Ordervärde" value={formatMinorSek(paidTotal)} />
        <Metric title="Legacy-order" value={String(data.paidOrders.length)} />
        <Metric title="Sponsorplatser" value={String(data.sponsorCampaigns.length)} />
        <Metric title="Direktjobb" value={String(data.paidJobPosts.length)} />
        <Metric title="Profiler" value={String(data.employerProfiles.length)} />
      </section>

      <section className="admin-panel">
        <h2>Legacy-order</h2>
        <AdminTable
          headers={["Status", "Produkt", "Belopp", "Externa ID:n", "Uppdaterad"]}
          rows={data.paidOrders.map((order) => [
            order.status,
            `${order.productSku} (${productTypeLabel(order.productType)})`,
            order.amountTotal ? formatMinorSek(order.amountTotal) : "-",
            [order.stripeCheckoutSessionId, order.stripeSubscriptionId, order.stripePaymentIntentId].filter(Boolean).join(" / ") || "-",
            formatDateTime(order.updatedAt)
          ])}
        />
      </section>

      <section className="admin-grid">
        <AdminSection title="Sponsorplatser (pausade)">
          <PausedAdminNotice label="Sponsorplatser" />
          <RecordList
            kind="sponsor"
            records={data.sponsorCampaigns.map((item) => ({ id: item.id, title: item.headline, status: item.status }))}
          />
        </AdminSection>

        <AdminSection title="Betalda direktjobb (pausade)">
          <PausedAdminNotice label="Betalda direktjobb" />
          <RecordList
            kind="paid_job"
            records={data.paidJobPosts.map((item) => ({ id: item.id, title: `${item.title} · ${item.employerName}`, status: item.status }))}
          />
        </AdminSection>

        <AdminSection title="Arbetsgivarprofiler (pausade)">
          <PausedAdminNotice label="Arbetsgivarprofiler" />
          <RecordList
            kind="employer_profile"
            records={data.employerProfiles.map((item) => ({ id: item.slug, title: item.employerName, status: item.status }))}
          />
        </AdminSection>

        <AdminSection title="Kvalitetsrapporter (pausade)">
          <PausedAdminNotice label="Kvalitetsrapporter" />
          <RecordList
            kind="employer_report"
            records={data.employerQualityReports.map((item) => ({ id: item.id, title: item.employerName, status: item.status }))}
          />
        </AdminSection>

        <AdminSection title="Nyhetsbrevssponsring (pausad)">
          <PausedAdminNotice label="Nyhetsbrevssponsring" />
          <RecordList
            kind="newsletter_sponsorship"
            records={data.newsletterSponsorships.map((item) => ({ id: item.id, title: item.headline, status: item.status }))}
          />
        </AdminSection>

        <AdminSection title="Partnerplaceringar">
          <AffiliateForm />
          <RecordList
            kind="affiliate"
            records={data.affiliateCampaigns.map((item) => ({ id: item.id, title: item.headline, status: item.status }))}
          />
        </AdminSection>
      </section>

      <section className="admin-panel">
        <h2>Senaste händelser</h2>
        <AdminTable
          headers={["Typ", "Entitet", "Källa", "Tid"]}
          rows={data.monetizationEvents.map((event) => [
            event.eventType,
            [event.entityType, event.entityId].filter(Boolean).join(" / ") || "-",
            event.source || "-",
            formatDateTime(event.createdAt)
          ])}
        />
      </section>
    </main>
  );
}

async function setRecordStatusAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  await updateMonetizationStatus(
    field(formData, "kind") as MonetizationRecordKind,
    field(formData, "id"),
    field(formData, "status") as ApprovalStatus
  );
  revalidatePath("/admin");
  revalidatePath("/");
}

async function createSponsorAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  await upsertSponsorCampaign({
    id: slugValue(formData, "id", field(formData, "headline")),
    label: field(formData, "label") === "Annons" ? "Annons" : "Sponsrad",
    category: field(formData, "category", 80) || "all",
    placement: field(formData, "placement") === "empty_state" ? "empty_state" : "top_search",
    headline: field(formData, "headline", 120),
    body: field(formData, "body", 280),
    cta: field(formData, "cta", 60),
    destinationUrl: urlField(formData, "destinationUrl"),
    disclosure: field(formData, "disclosure", 180) || "Sponsrad placering. Organiska jobbresultat påverkas inte.",
    activeFrom: dateTimeField(formData, "activeFrom", new Date()),
    activeTo: dateTimeField(formData, "activeTo", addMonths(1)),
    priority: numberField(formData, "priority", 50),
    allowedContexts: {
      categories: listField(formData, "categories"),
      workModes: listField(formData, "workModes") as Array<WorkMode | "all">,
      locations: listField(formData, "locations")
    },
    status: statusField(formData)
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

async function createPaidJobAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  await upsertPaidJobPost({
    id: slugValue(formData, "id", `${field(formData, "employerName")}-${field(formData, "title")}`),
    title: field(formData, "title", 140),
    employerName: field(formData, "employerName", 120),
    employerProfileSlug: labelToSlug(field(formData, "employerName", 120)),
    municipality: field(formData, "municipality", 80),
    region: field(formData, "region", 80) || field(formData, "municipality", 80),
    country: "Sverige",
    employmentExtent: employmentExtentField(formData),
    employmentTypeText: field(formData, "employmentTypeText", 80) || "Ej angivet",
    workMode: workModeField(formData),
    salaryText: field(formData, "salaryText", 120) || "Lön ej angiven",
    plainSummary: field(formData, "plainSummary", 500),
    descriptionText: field(formData, "descriptionText", 3000),
    applyUrl: urlField(formData, "applyUrl"),
    applicationDeadline: optionalDateTimeField(formData, "applicationDeadline"),
    publicationDate: new Date().toISOString(),
    approvedAt: statusField(formData) === "approved" ? new Date().toISOString() : undefined,
    expiresAt: optionalDateTimeField(formData, "expiresAt") ?? dateTimeField(formData, "expiresFallback", addMonths(1)),
    status: statusField(formData)
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

async function createEmployerProfileAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  const employerName = field(formData, "employerName", 120);
  await upsertEmployerProfile({
    slug: slugValue(formData, "slug", employerName),
    employerName,
    organizationNumber: field(formData, "organizationNumber", 40) || undefined,
    websiteUrl: optionalUrlField(formData, "websiteUrl"),
    logoUrl: optionalUrlField(formData, "logoUrl"),
    summary: field(formData, "summary", 900),
    specialties: listField(formData, "specialties"),
    status: statusField(formData)
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

async function createEmployerReportAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  const employerName = field(formData, "employerName", 120);
  const employerDomain = field(formData, "employerDomain", 120) || undefined;
  const findings = await buildEmployerQualityFindings({ employerName, employerDomain });
  await upsertEmployerQualityReport({
    id: slugValue(formData, "id", `${employerName}-${new Date().toISOString().slice(0, 10)}`),
    employerName,
    employerDomain,
    status: "generated",
    reportPeriodStart: dateTimeField(formData, "periodStart", addMonths(-1)),
    reportPeriodEnd: new Date().toISOString(),
    findings,
    generatedAt: new Date().toISOString()
  });
  revalidatePath("/admin");
}

async function createNewsletterAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  await upsertNewsletterSponsorship({
    id: slugValue(formData, "id", field(formData, "headline")),
    headline: field(formData, "headline", 120),
    body: field(formData, "body", 280),
    cta: field(formData, "cta", 60),
    destinationUrl: urlField(formData, "destinationUrl"),
    campaignDate: optionalDateOnlyField(formData, "campaignDate"),
    status: statusField(formData)
  });
  revalidatePath("/admin");
}

async function createAffiliateAction(formData: FormData) {
  "use server";
  await requireAdminAccess();
  await upsertAffiliateCampaign({
    id: slugValue(formData, "id", field(formData, "headline")),
    label: field(formData, "label", 80) || "Partner",
    category: field(formData, "category", 80) || "career",
    placement: field(formData, "placement", 80) || "resource",
    headline: field(formData, "headline", 120),
    body: field(formData, "body", 280),
    cta: field(formData, "cta", 60),
    destinationUrl: urlField(formData, "destinationUrl"),
    disclosure: field(formData, "disclosure", 180) || "Betald placering. Organiska jobbresultat påverkas inte.",
    status: statusField(formData)
  });
  revalidatePath("/admin");
}

function SponsorForm() {
  return (
    <form className="admin-form" action={createSponsorAction}>
      <TextInput name="headline" label="Rubrik" required />
      <TextInput name="body" label="Text" required />
      <TextInput name="cta" label="CTA" required />
      <TextInput name="destinationUrl" label="Publik destinationslänk" required />
      <TextInput name="category" label="Kategori" placeholder="all, a-kassa, utbildning" />
      <TextInput name="categories" label="Tillåtna kategorier" placeholder="all, IT, Vård" />
      <TextInput name="workModes" label="Arbetsformer" placeholder="all, remote, hybrid" />
      <TextInput name="locations" label="Platser" placeholder="Stockholm, Göteborg" />
      <Select name="placement" label="Placering" options={[["top_search", "Toppsök"], ["empty_state", "Tomt resultat"]]} />
      <Select name="label" label="Märkning" options={[["Sponsrad", "Sponsrad"], ["Annons", "Annons"]]} />
      <TextInput name="activeFrom" label="Startdatum" type="date" />
      <TextInput name="activeTo" label="Slutdatum" type="date" />
      <TextInput name="priority" label="Prioritet" type="number" placeholder="50" />
      <StatusSelect />
      <button type="submit">Spara sponsor</button>
    </form>
  );
}

function PaidJobForm() {
  return (
    <form className="admin-form" action={createPaidJobAction}>
      <TextInput name="title" label="Jobbtitel" required />
      <TextInput name="employerName" label="Arbetsgivare" required />
      <TextInput name="municipality" label="Kommun" required />
      <TextInput name="region" label="Region" />
      <TextInput name="applyUrl" label="Extern ansökningslänk" required />
      <TextInput name="plainSummary" label="Kort sammanfattning" required />
      <Textarea name="descriptionText" label="Publik annonstext" required />
      <Select name="workMode" label="Arbetsform" options={[["unclear", "Oklar"], ["remote", "Distans"], ["hybrid", "Hybrid"], ["onsite", "På plats"]]} />
      <Select name="employmentExtent" label="Omfattning" options={[["unclear", "Oklar"], ["full_time", "Heltid"], ["part_time", "Deltid"], ["mixed", "Heltid/deltid"]]} />
      <TextInput name="employmentTypeText" label="Anställningstext" />
      <TextInput name="salaryText" label="Lön" />
      <TextInput name="applicationDeadline" label="Ansök senast" type="date" />
      <TextInput name="expiresAt" label="Publiceras till" type="date" />
      <StatusSelect />
      <button type="submit">Spara direktjobb</button>
    </form>
  );
}

function EmployerProfileForm() {
  return (
    <form className="admin-form" action={createEmployerProfileAction}>
      <TextInput name="employerName" label="Arbetsgivare" required />
      <TextInput name="slug" label="Slug" />
      <TextInput name="organizationNumber" label="Organisationsnummer" />
      <TextInput name="websiteUrl" label="Publik webbplats" />
      <TextInput name="logoUrl" label="Publik logotyp-URL" />
      <Textarea name="summary" label="Publik beskrivning" required />
      <TextInput name="specialties" label="Specialiteter" placeholder="IT, SaaS, Stockholm" />
      <StatusSelect />
      <button type="submit">Spara profil</button>
    </form>
  );
}

function EmployerReportForm() {
  return (
    <form className="admin-form" action={createEmployerReportAction}>
      <TextInput name="employerName" label="Arbetsgivare" required />
      <TextInput name="employerDomain" label="Ansökningsdomän" placeholder="exempel.se" />
      <TextInput name="periodStart" label="Period från" type="date" />
      <button type="submit">Generera rapportmetadata</button>
    </form>
  );
}

function NewsletterForm() {
  return (
    <form className="admin-form" action={createNewsletterAction}>
      <TextInput name="headline" label="Rubrik" required />
      <TextInput name="body" label="Text" required />
      <TextInput name="cta" label="CTA" required />
      <TextInput name="destinationUrl" label="Publik destinationslänk" required />
      <TextInput name="campaignDate" label="Utskickdatum" type="date" />
      <StatusSelect />
      <button type="submit">Spara nyhetsbrevssponsor</button>
    </form>
  );
}

function AffiliateForm() {
  return (
    <form className="admin-form" action={createAffiliateAction}>
      <TextInput name="headline" label="Rubrik" required />
      <TextInput name="body" label="Text" required />
      <TextInput name="cta" label="CTA" required />
      <TextInput name="destinationUrl" label="Publik destinationslänk" required />
      <TextInput name="label" label="Märkning" placeholder="Partner" />
      <TextInput name="category" label="Kategori" placeholder="a-kassa, utbildning" />
      <TextInput name="placement" label="Placering" placeholder="resource" />
      <TextInput name="disclosure" label="Disclosure" />
      <StatusSelect />
      <button type="submit">Spara partnerplacering</button>
    </form>
  );
}

function RecordList({ kind, records }: { kind: MonetizationRecordKind; records: Array<{ id: string; title: string; status: string }> }) {
  if (!records.length) return <p className="panel-empty">Inga poster ännu.</p>;
  return (
    <div className="admin-record-list">
      {records.map((record) => (
        <article key={record.id}>
          <div>
            <strong>{record.title}</strong>
            <span>{record.id} · {record.status}</span>
          </div>
          <form action={setRecordStatusAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={record.id} />
            <select name="status" defaultValue={record.status}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paused">Paused</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              {kind === "employer_report" ? <option value="delivered">Delivered</option> : null}
            </select>
            <button type="submit">Uppdatera</button>
          </form>
        </article>
      ))}
    </div>
  );
}

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PausedAdminNotice({ label }: { label: string }) {
  return <p className="panel-empty">{label} är pausat i ads/affiliate-only-läge. Befintliga poster kan fortfarande statusändras.</p>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AdminTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="panel-empty">Inga rader ännu.</p>;
  return (
    <div className="admin-table">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextInput({ name, label, required = false, type = "text", placeholder }: { name: string; label: string; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} />
    </label>
  );
}

function Textarea({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
  return (
    <label>
      <span>{label}</span>
      <textarea name={name} required={required} rows={5} />
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: Array<[string, string]> }) {
  return (
    <label>
      <span>{label}</span>
      <select name={name}>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
}

function StatusSelect() {
  return (
    <Select
      name="status"
      label="Status"
      options={[
        ["pending", "Pending"],
        ["approved", "Approved"],
        ["paused", "Paused"],
        ["rejected", "Rejected"]
      ]}
    />
  );
}

function field(formData: FormData, key: string, max = 200) {
  const value = formData.get(key);
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function listField(formData: FormData, key: string) {
  return field(formData, key, 500)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function urlField(formData: FormData, key: string) {
  const value = field(formData, key, 500);
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(`${key} must be http(s).`);
  return parsed.toString();
}

function optionalUrlField(formData: FormData, key: string) {
  const value = field(formData, key, 500);
  if (!value) return undefined;
  return urlField(formData, key);
}

function slugValue(formData: FormData, key: string, fallback: string) {
  return labelToSlug(field(formData, key, 120) || fallback);
}

function statusField(formData: FormData): ApprovalStatus {
  const status = field(formData, "status");
  if (status === "approved" || status === "paused" || status === "rejected" || status === "expired") return status;
  return "pending";
}

function workModeField(formData: FormData): WorkMode {
  const value = field(formData, "workMode");
  if (value === "remote" || value === "hybrid" || value === "onsite") return value;
  return "unclear";
}

function employmentExtentField(formData: FormData): EmploymentExtent {
  const value = field(formData, "employmentExtent");
  if (value === "full_time" || value === "part_time" || value === "mixed") return value;
  return "unclear";
}

function numberField(formData: FormData, key: string, fallback: number) {
  const value = Number(field(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function dateTimeField(formData: FormData, key: string, fallback: Date) {
  return optionalDateTimeField(formData, key) ?? fallback.toISOString();
}

function optionalDateTimeField(formData: FormData, key: string) {
  const value = field(formData, key);
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function optionalDateOnlyField(formData: FormData, key: string) {
  return optionalDateTimeField(formData, key)?.slice(0, 10);
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

function formatMinorSek(value: number) {
  return formatSek(Math.round(value / 100));
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Stockholm"
  }).format(new Date(value));
}
