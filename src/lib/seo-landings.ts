import { getDisplayTitle } from "@/lib/job-title";
import { getSearchConsoleLandingTargets } from "@/lib/query-landing-intents";
import { filterJobs } from "@/lib/search";
import { labelToSlug } from "@/lib/slugs";
import type { Job } from "@/lib/types";

export interface LandingLink {
  description: string;
  href: string;
  label: string;
}

export interface LandingLinkGroup {
  links: LandingLink[];
  title: string;
}

export interface LandingGuide {
  sections: Array<{ title: string; text: string }>;
  title: string;
}

export interface JobLandingContent {
  count: number;
  description: string;
  guide: LandingGuide;
  indexable: boolean;
  jobs: Job[];
  metaTitle: string;
  title: string;
  text: string;
}

interface LandingTarget {
  count: number;
  href: string;
  label: string;
  lastModified?: Date;
  location?: string;
  role?: string;
}

const roleLocationSitemapLimit = 1_500;
const priorityMunicipalities = [
  "Helsingborg",
  "Linköping",
  "Uppsala",
  "Västerås",
  "Göteborg",
  "Eskilstuna",
  "Stenungsund",
  "Trosa",
  "Borås",
  "Finspång",
  "Laholm",
  "Katrineholm",
  "Lidingö",
  "Morgongåva",
  "Västervik",
  "Kristianstad",
  "Värnamo",
  "Botkyrka",
  "Tyresö",
  "Burlöv",
  "Halmstad",
  "Umeå",
  "Örebro",
  "Stockholm",
  "Malmö"
];

const priorityRoleLocationTargets: Array<{ location: string; role: string }> = [
  { role: "Marknadsförare", location: "Göteborg" },
  { role: "Arbetsledare", location: "Stockholm" },
  { role: "Arbetsledare", location: "Malmö" },
  { role: "Lagerarbetare", location: "Haninge" },
  { role: "Lagerarbetare", location: "Trollhättan" },
  { role: "Chaufför", location: "Trollhättan" },
  { role: "Marknadsförare", location: "Norrköping" },
  { role: "Montör", location: "Borås" },
  { role: "Montör", location: "Västerås" },
  { role: "Medarbetare", location: "Finspång" },
  { role: "Lagerarbetare", location: "Katrineholm" },
  { role: "Lokalvårdare", location: "Västervik" },
  { role: "Snickare", location: "Kristianstad" },
  { role: "Arbetsledare", location: "Värnamo" },
  { role: "Snickare", location: "Trollhättan" },
  { role: "Sjuksköterska", location: "Botkyrka" },
  { role: "Undersköterska", location: "Tyresö" },
  { role: "Sjuksköterska", location: "Burlöv" },
  { role: "Ekonom", location: "Stockholm" },
  { role: "Projektledare", location: "Göteborg" },
  { role: "Projektledare", location: "Halmstad" },
  { role: "Systemutvecklare", location: "Umeå" },
  { role: "Chaufför", location: "Göteborg" },
  { role: "Lokalvårdare", location: "Örnsköldsvik" }
];

const roleSearchPhrases: Record<string, string> = {
  "Arbetsledare": "jobb som arbetsledare",
  "Backend Utvecklare": "backendjobb",
  "Butiksmedarbetare": "butiksjobb",
  "Chaufför": "chaufförsjobb",
  "Ekonom": "ekonomijobb",
  "Frontend Utvecklare": "frontendjobb",
  "Fullstack Utvecklare": "fullstackjobb",
  "Gruppchef": "gruppchefsjobb",
  "HR-specialist": "HR-jobb",
  "Kock": "kockjobb",
  "Kundtjänstmedarbetare": "kundtjänstjobb",
  "Lagerarbetare": "lagerjobb",
  "Lokalvårdare": "lokalvårdsjobb",
  "Marknadsförare": "marknadsföringsjobb",
  "Medarbetare": "medarbetarjobb",
  "Montör": "montörjobb",
  "Personlig assistent": "jobb som personlig assistent",
  "Projektledare": "projektledarjobb",
  "Serveringspersonal": "serveringsjobb",
  "Sjuksköterska": "sjuksköterskejobb",
  "Snickare": "snickarjobb",
  "Systemutvecklare": "utvecklarjobb",
  "Taxiförare": "taxijobb",
  "Undersköterska": "undersköterskejobb",
  "UX/UI Designer": "UX- och UI-jobb"
};

export function buildHomeLanding(jobs: Job[], filteredCount: number): JobLandingContent {
  return {
    count: filteredCount,
    description: "Sök aktuella jobb i Sverige med tydliga filter för ort, roll, distans, heltid, deltid, lönesignal och ansökningslänk.",
    guide: {
      title: "Hur Job Search Demo hjälper jobbsökare",
      sections: [
        {
          title: "Samma sökning, renare urval",
          text: "Vi samlar publika jobbannonser och lägger ett eget lager ovanpå källdatan: arbetsform, senioritet, arbetsgivartyp, lönesignal, språkkrav och länkstatus."
        },
        {
          title: "Mindre brus från sälj och mellanhänder",
          text: "Säljtunga annonser, rekryterare och bemanningsbolag döljs som standard när de går att identifiera. Du kan slå på dem igen om du vill se hela marknaden."
        },
        {
          title: "Ansökan sker hos källan",
          text: "Varje jobbkort leder vidare till arbetsgivarens eller annonsörens egen ansökningssida och visar destination, länkstatus och varför annonsen matchade sökningen."
        }
      ]
    },
    indexable: true,
    jobs,
    metaTitle: "Lediga jobb i Sverige",
    title: "Lediga jobb i Sverige",
    text: resultText(filteredCount, "jobb", "jobb", "Filtrera på yrke, ort, arbetsform, omfattning, senioritet, arbetsgivartyp och annonser där lön anges.")
  };
}

export function buildMunicipalityLanding(jobs: Job[], municipality: string): JobLandingContent {
  const filtered = filterJobs(jobs, { location: municipality });

  return {
    count: filtered.length,
    description: `Hitta aktuella lediga jobb i ${municipality}. Filtrera på roll, distans, heltid, deltid, lönesignal och ansök direkt hos källan.`,
    guide: {
      title: `Så söker du jobb i ${municipality}`,
      sections: [
        {
          title: "Börja med orten",
          text: `Sidan är förfiltrerad på ${municipality}, så resultatlistan visar jobb där kommunen, regionen eller arbetsplatsinformationen matchar orten.`
        },
        {
          title: "Förfina med roll och villkor",
          text: "Lägg till yrke, arbetsform, omfattning, senioritet och lönesignal för att snabbt hitta annonser som passar din situation."
        },
        {
          title: "Gå vidare till rätt ansökan",
          text: "Jobbkorten visar arbetsgivare, ansökningsdestination och länkstatus innan du lämnar portalen för att ansöka hos källan."
        }
      ]
    },
    indexable: true,
    jobs: filtered,
    metaTitle: `Lediga jobb i ${municipality}`,
    title: `Lediga jobb i ${municipality}`,
    text: resultText(filtered.length, "jobb", "jobb", `i ${municipality}. Fortsätt med yrkesfilter, arbetsform, omfattning, senioritet och annonser där lön anges.`)
  };
}

export function buildRoleLanding(jobs: Job[], role: string): JobLandingContent {
  const filtered = filterJobs(jobs, { query: role });
  const rolePhrase = roleSearchPhrase(role);

  return {
    count: filtered.length,
    description: `Hitta aktuella ${rolePhrase}. Filtrera på ort, distans, heltid, deltid, lönesignal och gå vidare till rätt ansökan.`,
    guide: {
      title: `Så hittar du rätt ${rolePhrase}`,
      sections: [
        {
          title: "Börja med rollen",
          text: `Sidan är förfiltrerad på ${role}, så du landar direkt i rätt yrkesområde och kan välja ort efteråt.`
        },
        {
          title: "Förfina efter villkor",
          text: "Lägg till ort, arbetsform, omfattning, senioritet och lönesignal för att hitta annonser som passar bättre."
        },
        {
          title: "Gå vidare med kontroll",
          text: "Jobbkorten visar arbetsgivare, ansökningsdestination, länkstatus och matchningsförklaring innan du går vidare till källan."
        }
      ]
    },
    indexable: true,
    jobs: filtered,
    metaTitle: `Lediga ${rolePhrase}`,
    title: `Lediga ${rolePhrase}`,
    text: resultText(filtered.length, "annons", "annonser", `för ${rolePhrase}. Förfina med ort, arbetsform, omfattning, senioritet och annonser där lön anges.`)
  };
}

export function buildRoleLocationLanding(jobs: Job[], role: string, location: string): JobLandingContent {
  const filtered = filterJobs(jobs, { query: role, location });
  const title = buildRoleLocationTitle(role, location);
  const rolePhrase = roleSearchPhrase(role);

  return {
    count: filtered.length,
    description: `Hitta aktuella ${rolePhrase} i ${location}. Jämför arbetsform, omfattning, lönesignal och gå vidare till rätt ansökan.`,
    guide: {
      title: `Så hittar du rätt ${rolePhrase} i ${location}`,
      sections: [
        {
          title: "Rätt roll och rätt ort från start",
          text: `Sidan är förfiltrerad på ${role} i ${location}, vilket gör att sökningen leder direkt till den del av jobbmarknaden som matchar avsikten.`
        },
        {
          title: "Sortera bort brus",
          text: "Resultaten kan fortsätta filtreras på arbetsform, omfattning, senioritet, arbetsgivartyp och lönesignal. Säljbrus och mellanhänder är dolda som standard."
        },
        {
          title: "Kontroll före ansökan",
          text: "Varje annons visar arbetsgivare, ansökningsdestination, länkstatus och matchningsförklaring innan du går vidare till källan."
        }
      ]
    },
    indexable: true,
    jobs: filtered,
    metaTitle: title,
    title,
    text: resultText(filtered.length, "annons", "annonser", `matchar ${rolePhrase} i ${location}. Förfina resultatet med arbetsform, omfattning, senioritet, arbetsgivartyp och annonser där lön anges.`)
  };
}

export function buildRemoteLanding(jobs: Job[]): JobLandingContent {
  const filtered = filterJobs(jobs, { workMode: "remote" });

  return {
    count: filtered.length,
    description: "Hitta aktuella distansjobb i Sverige. Filtrera på roll, ort, omfattning, senioritet, lönesignal och ansökningslänk.",
    guide: {
      title: "Så granskar vi distansjobb",
      sections: [
        {
          title: "Distansmarkering från annonsdata",
          text: "Sidan visar jobb där arbetsformen har klassats som distans. När en annons är otydlig hamnar den inte automatiskt här."
        },
        {
          title: "Fortsatt filtrering för relevans",
          text: "Du kan kombinera distansläget med yrke, senioritet, omfattning, lön och arbetsgivartyp för att snabbare hitta rätt roll."
        },
        {
          title: "Transparens innan ansökan",
          text: "Varje jobb visar arbetsgivare, länkstatus, ansökningsdestination och varför jobbet visas. Ansökan sker alltid hos källan."
        }
      ]
    },
    indexable: true,
    jobs: filtered,
    metaTitle: "Lediga jobb på distans",
    title: "Lediga jobb på distans",
    text: resultText(filtered.length, "distansjobb", "distansjobb", "Sidan lyfter annonser där källan anger distansarbete och låter dig fortsätta filtrera på roll, ort, omfattning och lön.")
  };
}

export function buildHomeLandingLinkGroups(jobs: Job[]): LandingLinkGroup[] {
  return nonEmptyGroups([
    {
      title: "Populära orter",
      links: mergeTargets([
        ...getPriorityMunicipalityTargets(jobs, 10),
        ...getTopMunicipalityTargets(jobs, 10)
      ]).slice(0, 10).map(municipalityTargetToLink)
    },
    {
      title: "Efterfrågade roll- och ortssökningar",
      links: mergeTargets([
        ...getPriorityRoleLocationTargets(jobs, 12),
        ...getTopRoleLocationTargets(jobs, 12)
      ]).slice(0, 12).map(roleLocationTargetToLink)
    }
  ]);
}

export function buildMunicipalityLandingLinkGroups(jobs: Job[], municipality: string): LandingLinkGroup[] {
  return nonEmptyGroups([
    {
      title: `Populära roller i ${municipality}`,
      links: getTopRoleLocationTargets(jobs, 8, { location: municipality }).map(roleLocationTargetToLink)
    },
    {
      title: "Liknande orter",
      links: getTopMunicipalityTargets(jobs, 8, { excludeMunicipalities: [municipality] }).map(municipalityTargetToLink)
    }
  ]);
}

export function buildRoleLandingLinkGroups(jobs: Job[], role: string): LandingLinkGroup[] {
  return nonEmptyGroups([
    {
      title: `${role} på populära orter`,
      links: mergeTargets([
        ...getSearchConsoleLandingTargets(["role_location"])
          .filter((target) => target.role === role)
          .map(queryTargetToLandingTarget),
        ...getTopRoleLocationTargets(jobs, 8, { role })
      ]).slice(0, 8).map(roleLocationTargetToLink)
    },
    {
      title: "Andra efterfrågade roller",
      links: mergeTargets([
        ...getSearchConsoleLandingTargets(["role"])
          .filter((target) => target.role !== role)
          .map(queryTargetToLandingTarget),
        ...getTopRoleTargets(jobs, 8, { excludeRoles: [role] })
      ]).slice(0, 8).map(roleTargetToLink)
    }
  ]);
}

export function buildRoleLocationLandingLinkGroups(jobs: Job[], role: string, location: string): LandingLinkGroup[] {
  return nonEmptyGroups([
    {
      title: `Fler roller i ${location}`,
      links: getTopRoleLocationTargets(jobs, 8, { excludeRoles: [role], location }).map(roleLocationTargetToLink)
    },
    {
      title: `${role} på fler orter`,
      links: getTopRoleLocationTargets(jobs, 8, { excludeMunicipalities: [location], role }).map(roleLocationTargetToLink)
    }
  ]);
}

export function getIndexableMunicipalityTargets(jobs: Job[]): LandingTarget[] {
  return mergeTargets([
    ...getSearchConsoleLandingTargets(["municipality"]).map(queryTargetToLandingTarget),
    ...getTopMunicipalityTargets(jobs, Number.POSITIVE_INFINITY)
  ]);
}

export function getIndexableRoleTargets(jobs: Job[]): LandingTarget[] {
  return mergeTargets([
    ...getSearchConsoleLandingTargets(["role"]).map(queryTargetToLandingTarget),
    ...getTopRoleTargets(jobs, Number.POSITIVE_INFINITY)
  ]);
}

export function getIndexableRoleLocationTargets(jobs: Job[]): LandingTarget[] {
  return mergeTargets([
    ...getSearchConsoleLandingTargets(["role_location"]).map(queryTargetToLandingTarget),
    ...getPriorityRoleLocationTargets(jobs, priorityRoleLocationTargets.length),
    ...getTopRoleLocationTargets(jobs, roleLocationSitemapLimit)
  ]).slice(0, roleLocationSitemapLimit);
}

export function roleSearchPhrase(role: string) {
  return roleSearchPhrases[role] ?? `jobb som ${role.toLocaleLowerCase("sv-SE")}`;
}

function buildRoleLocationTitle(role: string, location: string) {
  return `Lediga ${roleSearchPhrase(role)} i ${location}`;
}

function getPriorityMunicipalityTargets(jobs: Job[], limit: number): LandingTarget[] {
  const allTargets = new Map(getTopMunicipalityTargets(jobs, Number.POSITIVE_INFINITY).map((target) => [target.label, target]));
  return priorityMunicipalities
    .map((municipality) => allTargets.get(municipality))
    .filter(isLandingTarget)
    .slice(0, limit);
}

function getPriorityRoleLocationTargets(jobs: Job[], limit: number): LandingTarget[] {
  return priorityRoleLocationTargets
    .map(({ role, location }) => toRoleLocationTarget(jobs, role, location))
    .filter(isLandingTarget)
    .slice(0, limit);
}

function getTopMunicipalityTargets(
  jobs: Job[],
  limit: number,
  options: { excludeMunicipalities?: string[] } = {}
): LandingTarget[] {
  const excluded = new Set((options.excludeMunicipalities ?? []).map(normalizeKey));
  const grouped = new Map<string, LandingTarget>();

  for (const job of defaultVisibleJobs(jobs)) {
    const municipality = job.municipality?.trim();
    if (!isUsefulLandingLabel(municipality) || excluded.has(normalizeKey(municipality))) continue;
    const href = `/jobb/kommun/${labelToSlug(municipality)}`;
    const current = grouped.get(municipality) ?? {
      count: 0,
      href,
      label: municipality
    };
    current.count += 1;
    current.lastModified = laterDate(current.lastModified, parseDate(job.updatedAt ?? job.publicationDate));
    grouped.set(municipality, current);
  }

  return Array.from(grouped.values())
    .sort(compareTargets)
    .slice(0, limit);
}

function getTopRoleTargets(
  jobs: Job[],
  limit: number,
  options: { excludeRoles?: string[] } = {}
): LandingTarget[] {
  const excluded = new Set((options.excludeRoles ?? []).map(normalizeKey));
  const grouped = new Map<string, LandingTarget>();

  for (const job of defaultVisibleJobs(jobs)) {
    const role = (job.titleCanonical || getDisplayTitle(job)).trim();
    if (!isUsefulLandingLabel(role) || excluded.has(normalizeKey(role))) continue;
    const href = `/jobb/roll/${labelToSlug(role)}`;
    const current = grouped.get(href) ?? {
      count: 0,
      href,
      label: `Lediga ${roleSearchPhrase(role)}`,
      role
    };
    current.count += 1;
    current.lastModified = laterDate(current.lastModified, parseDate(job.updatedAt ?? job.publicationDate));
    grouped.set(href, current);
  }

  return Array.from(grouped.values())
    .sort(compareTargets)
    .slice(0, limit);
}

function getTopRoleLocationTargets(
  jobs: Job[],
  limit: number,
  options: {
    excludeMunicipalities?: string[];
    excludeRoles?: string[];
    location?: string;
    role?: string;
  } = {}
): LandingTarget[] {
  const excludedMunicipalities = new Set((options.excludeMunicipalities ?? []).map(normalizeKey));
  const excludedRoles = new Set((options.excludeRoles ?? []).map(normalizeKey));
  const locationFilter = normalizeKey(options.location);
  const roleFilter = normalizeKey(options.role);
  const grouped = new Map<string, LandingTarget>();

  for (const job of defaultVisibleJobs(jobs)) {
    const location = job.municipality?.trim();
    const role = (job.titleCanonical || getDisplayTitle(job)).trim();
    if (!isUsefulLandingLabel(location) || !isUsefulLandingLabel(role)) continue;
    if (excludedMunicipalities.has(normalizeKey(location)) || excludedRoles.has(normalizeKey(role))) continue;
    if (locationFilter && normalizeKey(location) !== locationFilter) continue;
    if (roleFilter && normalizeKey(role) !== roleFilter) continue;

    const href = `/jobb/${labelToSlug(role)}/${labelToSlug(location)}`;
    const key = href;
    const current = grouped.get(key) ?? {
      count: 0,
      href,
      label: buildRoleLocationTitle(role, location),
      location,
      role
    };
    current.count += 1;
    current.lastModified = laterDate(current.lastModified, parseDate(job.updatedAt ?? job.publicationDate));
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort(compareTargets)
    .slice(0, limit);
}

function toRoleLocationTarget(jobs: Job[], role: string, location: string): LandingTarget | undefined {
  const filtered = filterJobs(jobs, { query: role, location });
  return {
    count: filtered.length,
    href: `/jobb/${labelToSlug(role)}/${labelToSlug(location)}`,
    label: buildRoleLocationTitle(role, location),
    lastModified: getLatestJobUpdate(filtered),
    location,
    role
  };
}

function isLandingTarget(target: LandingTarget | undefined): target is LandingTarget {
  return Boolean(target);
}

function defaultVisibleJobs(jobs: Job[]) {
  return filterJobs(jobs, {});
}

function municipalityTargetToLink(target: LandingTarget): LandingLink {
  return {
    description: linkDescription(target, "jobb", "jobb"),
    href: target.href,
    label: `Lediga jobb i ${target.label}`
  };
}

function roleTargetToLink(target: LandingTarget): LandingLink {
  return {
    description: linkDescription(target, "annons", "annonser"),
    href: target.href,
    label: target.label
  };
}

function roleLocationTargetToLink(target: LandingTarget): LandingLink {
  return {
    description: linkDescription(target, "annons", "annonser"),
    href: target.href,
    label: target.label
  };
}

function queryTargetToLandingTarget(target: ReturnType<typeof getSearchConsoleLandingTargets>[number]): LandingTarget {
  return {
    count: 0,
    href: target.href,
    label: target.kind === "municipality" && target.location
      ? target.location
      : target.label,
    location: target.location,
    role: target.role
  };
}

function mergeTargets(targets: LandingTarget[]) {
  const byHref = new Map<string, LandingTarget>();
  for (const target of targets) {
    const current = byHref.get(target.href);
    if (!current) {
      byHref.set(target.href, { ...target });
      continue;
    }
    current.count = Math.max(current.count, target.count);
    current.lastModified = laterDate(current.lastModified, target.lastModified);
    current.location = current.location ?? target.location;
    current.role = current.role ?? target.role;
  }
  return Array.from(byHref.values());
}

function nonEmptyGroups(groups: LandingLinkGroup[]) {
  return groups.filter((group) => group.links.length);
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("sv-SE")} ${count === 1 ? singular : plural}`;
}

function resultText(count: number, singular: string, plural: string, suffix: string) {
  if (count > 0) return `${formatCount(count, singular, plural)} visas just nu. ${suffix}`;
  return `Sökningen är förfiltrerad och uppdateras när nya annonser finns i källorna. ${suffix}`;
}

function linkDescription(target: LandingTarget, singular: string, plural: string) {
  if (target.count > 0) return `${formatCount(target.count, singular, plural)} just nu`;
  return "Riktad jobbsökning";
}

function compareTargets(a: LandingTarget, b: LandingTarget) {
  return b.count - a.count || a.label.localeCompare(b.label, "sv-SE");
}

function isUsefulLandingLabel(value?: string) {
  const label = value?.trim();
  if (!label) return false;
  if (normalizeKey(label) === normalizeKey("Okänd ort")) return false;
  if (normalizeKey(label) === normalizeKey("Titel saknas")) return false;
  if (normalizeKey(label) === normalizeKey("Övrig tjänst")) return false;
  return label.length <= 56;
}

function normalizeKey(value = "") {
  return value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getLatestJobUpdate(jobs: Job[]) {
  return jobs.reduce<Date | undefined>((latest, job) => (
    laterDate(latest, parseDate(job.updatedAt ?? job.publicationDate))
  ), undefined);
}

function laterDate(a?: Date, b?: Date) {
  if (!a) return b;
  if (!b) return a;
  return b > a ? b : a;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
