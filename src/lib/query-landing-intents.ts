import { searchConsoleQueries } from "@/data/search-console-queries";
import { swedishLocalities } from "@/data/swedish-localities";
import { labelToSlug } from "@/lib/slugs";

export type QueryLandingKind = "employer" | "home" | "municipality" | "remote" | "role" | "role_location";

export interface QueryLandingTarget {
  href: string;
  impressions: number;
  kind: QueryLandingKind;
  label: string;
  location?: string;
  queryCount: number;
  role?: string;
}

const roleAliases: Array<{ aliases: string[]; role: string }> = [
  { role: "AI-konsult", aliases: ["ai konsult", "ai-konsult"] },
  { role: "Arbetsledare", aliases: ["arbetsledare", "team leader"] },
  { role: "Automationsingenjör", aliases: ["automationsingenjör", "automationsingenjor"] },
  { role: "Backend Utvecklare", aliases: ["backend", "backendutvecklare", "back end"] },
  { role: "Bilvårdare", aliases: ["valeting", "bilvård", "bilvard"] },
  { role: "Butikskonsulent", aliases: ["butikskonsulent"] },
  { role: "Butiksmedarbetare", aliases: ["butik", "butiksjobb", "butiksmedarbetare"] },
  { role: "Chaufför", aliases: ["chaufför", "chauffor", "chaffr", "förare", "forare"] },
  { role: "Dansledare", aliases: ["dansledare"] },
  { role: "Dental hygienist", aliases: ["dental hygienist"] },
  { role: "Ekonom", aliases: ["ekonomi", "ekonom", "ekonomijobb"] },
  { role: "Frontend Utvecklare", aliases: ["frontend", "frontendutvecklare", "front end"] },
  { role: "Frisör", aliases: ["frisör", "frisor", "frisörjobb", "frisorjobb"] },
  { role: "Fullstack Utvecklare", aliases: ["fullstack", "full stack"] },
  { role: "Gruppchef", aliases: ["gruppchef"] },
  { role: "Gympersonal", aliases: ["gym jobs", "gympersonal"] },
  { role: "HR-specialist", aliases: ["hr specialist", "hr-specialist", "human resources"] },
  { role: "Jurist", aliases: ["jurist", "legal counsel"] },
  { role: "Kock", aliases: ["kock"] },
  { role: "Kundtjänstmedarbetare", aliases: ["kundtjänst", "kundtjanst", "customer service"] },
  { role: "Köksbiträde", aliases: ["köksbiträde", "koksbitrade", "kökspersonal", "kokspersonal"] },
  { role: "Lagerarbetare", aliases: ["lagerjobb", "lagerarbetare", "lagerpersonal", "lager", "packare", "tredjepartslogistik"] },
  { role: "Lokalvårdare", aliases: ["lokalvård", "lokalvard", "lokalvårdare", "lokalvardare", "städare", "stadare"] },
  { role: "Lärare", aliases: ["lärare", "larare"] },
  { role: "Marknadsförare", aliases: ["marknadsföring", "marknadsforing", "marknadsförare", "marknadsforare", "marknadsjobb", "marknadsföringsjobb", "marknadsforingsjobb", "marknad", "marketing", "marketing manager"] },
  { role: "Medarbetare", aliases: ["medarbetare"] },
  { role: "Mekaniker", aliases: ["bilmekaniker", "mekaniker"] },
  { role: "Montör", aliases: ["montör", "montor", "fordonsmontör", "fordonsmontor"] },
  { role: "Målare", aliases: ["målare", "malare", "målarjobb", "malarjobb"] },
  { role: "Operations Manager", aliases: ["operations manager"] },
  { role: "Personlig assistent", aliases: ["personlig assistans", "personlig assistent"] },
  { role: "Product Manager", aliases: ["product manager"] },
  { role: "Produktchef", aliases: ["produktchef"] },
  { role: "Projektledare", aliases: ["projektledare", "project manager"] },
  { role: "Redovisningsassistent", aliases: ["redovisningsassistent"] },
  { role: "Revisor", aliases: ["revisor"] },
  { role: "Serveringspersonal", aliases: ["serveringspersonal", "servis", "servitör", "servitor", "servitris"] },
  { role: "Sjuksköterska", aliases: ["sjuksköterska", "sjukskoterska"] },
  { role: "Snickare", aliases: ["snickare"] },
  { role: "Språkcoach", aliases: ["språkcoach", "sprakcoach"] },
  { role: "Systemutvecklare", aliases: ["systemutvecklare", "utvecklare", "wordpress utvecklare", "wordpress-utvecklare", "developer"] },
  { role: "Taxiförare", aliases: ["taxiförare", "taxiforare", "taxichaufför", "taxichauffor"] },
  { role: "Tolk", aliases: ["tolk"] },
  { role: "Undersköterska", aliases: ["undersköterska", "underskoterska"] },
  { role: "Uthyrare", aliases: ["uthyrare"] },
  { role: "Veterinär", aliases: ["veterinär", "veterinar"] }
];

const customLocationAliases: Array<{ aliases: string[]; location: string }> = [
  { location: "Botkyrka", aliases: ["hallunda", "norsborg", "tumba"] },
  { location: "Haninge", aliases: ["handen"] },
  { location: "Helsingborg", aliases: ["hbg", "helsingborgs kommun", "helsingborgs stad", "hsng"] },
  { location: "Huddinge", aliases: ["kungens kurva"] },
  { location: "Lilla Edet", aliases: ["lilla edets kommun"] },
  { location: "Sigtuna", aliases: ["arlanda"] },
  { location: "Stockholm", aliases: ["kista", "kista galleria"] },
  { location: "Sundbyberg", aliases: ["sundbybergs kommun"] },
  { location: "Tingsryd", aliases: ["tingsryds kommun"] },
  { location: "Österåker", aliases: ["österåkers kommun", "osterakers kommun"] }
];

const normalizedRoleAliases = roleAliases
  .flatMap(({ role, aliases }) => [role, ...aliases].map((alias) => ({ alias: normalizeLandingText(alias), role })))
  .filter((item) => item.alias.length >= 2)
  .sort((a, b) => b.alias.length - a.alias.length);

const normalizedCustomLocationAliases = customLocationAliases
  .flatMap(({ location, aliases }) => aliases.map((alias) => ({ alias: normalizeLandingText(alias), location })))
  .sort((a, b) => b.alias.length - a.alias.length);

const normalizedLocations = Array.from(new Set([
  ...swedishLocalities.flatMap((locality) => [locality.name, locality.municipality, locality.region]),
  "Göteborg",
  "Linköping",
  "Malmö",
  "Stockholm",
  "Uppsala",
  "Västerås"
]))
  .map((location) => ({ location, value: normalizeLandingText(location) }))
  .filter((item) => item.value.length >= 3)
  .sort((a, b) => b.value.length - a.value.length);

export function resolveQueryLanding(query: string): QueryLandingTarget {
  const normalized = normalizeLandingText(query);
  const location = findLocation(normalized);
  const role = findRole(normalized);

  if (isEmployerIntent(normalized)) return employerTarget();
  if (isHomeIntent(normalized)) return homeTarget();
  if (normalized.includes("distans")) return remoteTarget();
  if (role && location) return roleLocationTarget(role, location);
  if (location) return municipalityTarget(location);
  if (role) return roleTarget(role);
  if (isGenericJobIntent(normalized)) return homeTarget();
  return homeTarget();
}

export function getSearchConsoleLandingTargets(kinds?: QueryLandingKind[]) {
  const allowedKinds = kinds?.length ? new Set<QueryLandingKind>(kinds) : undefined;
  const targets = new Map<string, QueryLandingTarget>();

  for (const row of searchConsoleQueries) {
    const target = resolveQueryLanding(row.query);
    if (allowedKinds && !allowedKinds.has(target.kind)) continue;
    const current = targets.get(target.href);
    if (!current) {
      targets.set(target.href, { ...target, impressions: row.impressions, queryCount: 1 });
      continue;
    }
    current.impressions += row.impressions;
    current.queryCount += 1;
  }

  return Array.from(targets.values()).sort((a, b) => b.impressions - a.impressions || a.label.localeCompare(b.label, "sv-SE"));
}

export function getSearchConsoleQueryCoverage() {
  return searchConsoleQueries.map((row) => ({
    ...row,
    landing: resolveQueryLanding(row.query)
  }));
}

export function normalizeLandingText(value = "") {
  return value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
}

function findRole(normalizedQuery: string) {
  return normalizedRoleAliases.find((item) => hasTerm(normalizedQuery, item.alias))?.role;
}

function findLocation(normalizedQuery: string) {
  const custom = normalizedCustomLocationAliases.find((item) => hasTerm(normalizedQuery, item.alias));
  if (custom) return custom.location;

  for (const item of normalizedLocations) {
    if (hasTerm(normalizedQuery, item.value) || hasTerm(normalizedQuery, `${item.value}s kommun`) || hasTerm(normalizedQuery, `${item.value} kommun`)) {
      return item.location;
    }
  }

  return undefined;
}

function hasTerm(value: string, term: string) {
  if (!value || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escaped}( |$)`).test(value);
}

function isEmployerIntent(value: string) {
  return /\b(rekrytera|rekrytering|rekryteringsforetag|recruiting)\b/.test(value) && !/\b(lediga|jobb|jobs)\b/.test(value);
}

function isHomeIntent(value: string) {
  return /\b(jobbportalen|jobsearchdemo|jobb portalen|loneportalen|jobbannonser|jobb annonser)\b/.test(value);
}

function isGenericJobIntent(value: string) {
  return /\b(ledig|lediga|jobb|jobs|soka jobb|hitta jobb|visa lediga platser)\b/.test(value);
}

function homeTarget(): QueryLandingTarget {
  return {
    href: "/",
    impressions: 0,
    kind: "home",
    label: "Lediga jobb i Sverige",
    queryCount: 0
  };
}

function employerTarget(): QueryLandingTarget {
  return {
    href: "/",
    impressions: 0,
    kind: "employer",
    label: "Lediga jobb i Sverige",
    queryCount: 0
  };
}

function remoteTarget(): QueryLandingTarget {
  return {
    href: "/distansjobb",
    impressions: 0,
    kind: "remote",
    label: "Lediga jobb på distans",
    queryCount: 0
  };
}

function municipalityTarget(location: string): QueryLandingTarget {
  return {
    href: `/jobb/kommun/${labelToSlug(location)}`,
    impressions: 0,
    kind: "municipality",
    label: `Lediga jobb i ${location}`,
    location,
    queryCount: 0
  };
}

function roleTarget(role: string): QueryLandingTarget {
  return {
    href: `/jobb/roll/${labelToSlug(role)}`,
    impressions: 0,
    kind: "role",
    label: `Lediga jobb: ${role}`,
    queryCount: 0,
    role
  };
}

function roleLocationTarget(role: string, location: string): QueryLandingTarget {
  return {
    href: `/jobb/${labelToSlug(role)}/${labelToSlug(location)}`,
    impressions: 0,
    kind: "role_location",
    label: `Lediga jobb: ${role} i ${location}`,
    location,
    queryCount: 0,
    role
  };
}
