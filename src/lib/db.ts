import { Pool } from "pg";

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

export interface ApplyClickEvent {
  jobId?: unknown;
  source?: unknown;
  sourceAdId?: unknown;
  destinationDomain?: unknown;
  applyType?: unknown;
  workMode?: unknown;
  classificationVersion?: unknown;
}

export interface SponsorEvent {
  type?: unknown;
  sponsorId?: unknown;
  placement?: unknown;
  source?: unknown;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function insertApplyClick(event: ApplyClickEvent) {
  const db = getPool();
  if (!db) return false;

  await ensureSchema();
  await db.query(
    `insert into apply_clicks
      (job_id, source, source_ad_id, destination_domain, apply_type, work_mode, classification_version)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      toText(event.jobId),
      toText(event.source),
      toText(event.sourceAdId),
      toText(event.destinationDomain),
      toText(event.applyType),
      toText(event.workMode),
      toText(event.classificationVersion)
    ]
  );
  return true;
}

export async function insertSponsorEvent(event: SponsorEvent) {
  const db = getPool();
  if (!db) return false;

  await ensureSchema();
  await db.query(
    `insert into sponsor_events (event_type, sponsor_id, placement, source)
     values ($1, $2, $3, $4)`,
    [
      toText(event.type) || "unknown",
      toText(event.sponsorId) || "unknown",
      toText(event.placement) || "unknown",
      toText(event.source)
    ]
  );
  return true;
}

export async function queryDatabase<T = Record<string, unknown>>(query: string, values: unknown[] = []) {
  const db = getPool();
  if (!db) return undefined;

  await ensureSchema();
  const result = await db.query(query, values);
  return result.rows as T[];
}

function getPool() {
  if (!process.env.DATABASE_URL) return undefined;
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db) return;
  schemaReady ??= db.query(`
    create table if not exists apply_clicks (
      id bigserial primary key,
      job_id text not null,
      source text,
      source_ad_id text,
      destination_domain text,
      apply_type text,
      work_mode text,
      classification_version text,
      clicked_at timestamptz not null default now()
    );

    create index if not exists apply_clicks_job_id_idx on apply_clicks (job_id);
    create index if not exists apply_clicks_clicked_at_idx on apply_clicks (clicked_at);

    create table if not exists sponsor_events (
      id bigserial primary key,
      event_type text not null,
      sponsor_id text not null,
      placement text not null,
      source text,
      created_at timestamptz not null default now()
    );

    create index if not exists sponsor_events_sponsor_id_idx on sponsor_events (sponsor_id);
    create index if not exists sponsor_events_placement_idx on sponsor_events (placement);
    create index if not exists sponsor_events_created_at_idx on sponsor_events (created_at);

    create table if not exists paid_orders (
      id text primary key,
      product_sku text not null,
      product_type text not null,
      billing_mode text not null,
      amount_total integer,
      currency text not null default 'sek',
      status text not null,
      stripe_checkout_session_id text,
      stripe_payment_intent_id text,
      stripe_subscription_id text,
      stripe_payment_link_id text,
      current_period_end timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists paid_orders_product_sku_idx on paid_orders (product_sku);
    create index if not exists paid_orders_product_type_idx on paid_orders (product_type);
    create index if not exists paid_orders_status_idx on paid_orders (status);
    create index if not exists paid_orders_subscription_idx on paid_orders (stripe_subscription_id);

    create table if not exists sponsor_campaigns (
      id text primary key,
      label text not null,
      category text not null,
      placement text not null,
      headline text not null,
      body text not null,
      cta text not null,
      destination_url text not null,
      disclosure text not null,
      active_from timestamptz not null,
      active_to timestamptz not null,
      priority integer not null default 0,
      allowed_contexts jsonb not null default '{}'::jsonb,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists sponsor_campaigns_status_idx on sponsor_campaigns (status);
    create index if not exists sponsor_campaigns_placement_idx on sponsor_campaigns (placement);

    create table if not exists paid_job_posts (
      id text primary key,
      title text not null,
      employer_name text not null,
      employer_profile_slug text,
      municipality text not null,
      region text,
      country text not null default 'Sverige',
      employment_extent text not null default 'unclear',
      employment_type_text text,
      work_mode text not null default 'unclear',
      salary_text text,
      plain_summary text not null,
      description_text text not null,
      apply_url text not null,
      apply_domain text not null,
      application_deadline timestamptz,
      publication_date timestamptz,
      status text not null default 'pending',
      approved_at timestamptz,
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists paid_job_posts_status_idx on paid_job_posts (status);
    create index if not exists paid_job_posts_employer_idx on paid_job_posts (employer_name);

    create table if not exists employer_profiles (
      slug text primary key,
      employer_name text not null,
      organization_number text,
      website_url text,
      logo_url text,
      summary text not null,
      specialties jsonb not null default '[]'::jsonb,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists employer_profiles_status_idx on employer_profiles (status);

    create table if not exists employer_quality_reports (
      id text primary key,
      employer_name text not null,
      employer_domain text,
      status text not null default 'pending',
      report_period_start timestamptz,
      report_period_end timestamptz,
      findings jsonb not null default '{}'::jsonb,
      generated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists employer_quality_reports_status_idx on employer_quality_reports (status);

    create table if not exists newsletter_sponsorships (
      id text primary key,
      headline text not null,
      body text not null,
      cta text not null,
      destination_url text not null,
      campaign_date date,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists newsletter_sponsorships_status_idx on newsletter_sponsorships (status);

    create table if not exists affiliate_campaigns (
      id text primary key,
      label text not null,
      category text not null,
      placement text not null,
      headline text not null,
      body text not null,
      cta text not null,
      destination_url text not null,
      disclosure text not null,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists affiliate_campaigns_status_idx on affiliate_campaigns (status);

    create table if not exists monetization_events (
      id bigserial primary key,
      event_type text not null,
      entity_type text,
      entity_id text,
      source text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists monetization_events_type_idx on monetization_events (event_type);
    create index if not exists monetization_events_created_at_idx on monetization_events (created_at);
  `).then(() => undefined);

  await schemaReady;
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
