import type { JobTechAd } from "./types";
import { includesAny, normalizeText } from "./classifiers";

export interface CanonicalTitleResult {
  canonicalTitle: string;
  titleCategory: string;
}

export function canonicalizeTitle(ad: JobTechAd): CanonicalTitleResult {
  const title = ad.headline ?? "";
  const occupation = `${ad.occupation?.label ?? ""} ${ad.occupation_field?.label ?? ""}`;
  const text = `${title} ${occupation} ${ad.description?.text ?? ""}`;
  const roleText = `${title} ${occupation}`;
  const titleOnly = title;

  const titleOnlyRules: Array<[string, string, string[]]> = [
    ["Personlig assistent", "Omsorg", ["personlig assistent", "personliga assistenter", "personlig assistans"]],
    ["Customer Success Manager", "Service", ["customer success manager"]],
    ["Säljare", "Försäljning", ["säljare", "innesäljare", "teknisk säljare", "försäljningsassistent", "sales promoter", "account manager", "account executive", "key account", "area sales", "inside sales"]],
    ["Försäljningschef", "Försäljning", ["försäljningschef", "försäljningchef", "sales manager", "säljchef"]],
    ["Förvaltningschef", "Ledning", ["förvaltningschef"]],
    ["Gruppchef", "Ledning", ["gruppchef"]],
    ["Arbetsledare", "Ledning", ["arbetsledare", "team leader"]],
    ["Operations Manager", "Ledning", ["operations manager"]],
    ["Samordnare", "Administration", ["samordnare", "koordinator", "coordinator"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of titleOnlyRules) {
    if (includesAny(titleOnly, terms)) return { canonicalTitle, titleCategory };
  }

  const priorityRules: Array<[string, string, string[]]> = [
    ["UX/UI Designer", "IT", ["ux designer", "ux-designer", "ui designer", "ui-designer", "ui/ux", "ux/ui", "user experience", "user interface", "produktdesigner", "product designer", "interaktionsdesigner", "digital designer"]],
    ["Applikationsspecialist", "IT", ["application specialist", "applikationsspecialist", "systemspecialist", "stibo step", "stibo daas"]],
    ["BI-utvecklare", "IT", ["business intelligence", "bi-utvecklare", "data warehouse", "power bi"]],
    ["Data Engineer", "IT", ["data engineer", "dataingenjör", "etl developer"]],
    ["Systemadministratör", "IT", ["systemadministratör", "system administrator", "it-administratör", "it administrator"]],
    ["IT-support", "IT", ["it-support", "supporttekniker", "helpdesk", "servicedesk"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of priorityRules) {
    if (includesAny(text, terms)) return { canonicalTitle, titleCategory };
  }

  const developer = classifyDeveloperTitle(roleText, text);
  if (developer) return developer;

  const rules: Array<[string, string, string[]]> = [
    ["Produktägare", "IT", ["produktägare", "product owner"]],
    ["Projektledare", "Projektledning", ["projektledare", "project manager", "program manager"]],
    ["Redovisningsassistent", "Ekonomi", ["redovisningsassistent"]],
    ["Revisor", "Ekonomi", ["revisor", "revision"]],
    ["Ekonom", "Ekonomi", ["ekonom", "controller", "redovisningsekonom"]],
    ["HR-specialist", "HR", ["hr ", "human resources", "rekryterare", "talent acquisition"]],
    ["Jurist", "Juridik", ["jurist", "affärsjurist"]],
    ["Marknadsförare", "Marknad", ["marknadsföring", "kommunikation", "sociala medier", "content"]],
    ["Säljare", "Försäljning", ["säljare", "sales", "account manager", "distriktssäljare", "försäljningschef"]],
    ["Kundtjänstmedarbetare", "Service", ["kundtjänst", "customer service", "supportmedarbetare"]],
    ["Undersköterska", "Vård", ["undersköterska"]],
    ["Sjuksköterska", "Vård", ["sjuksköterska"]],
    ["Läkare", "Vård", ["läkare", "vårdcentral"]],
    ["Veterinär", "Djurvård", ["veterinär"]],
    ["Djursjukskötare", "Djurvård", ["djursjukskötare"]],
    ["Personlig assistent", "Omsorg", ["personlig assistent"]],
    ["Barnskötare", "Utbildning", ["barnskötare"]],
    ["Lärare", "Utbildning", ["lärare", "grundskollärare", "förskollärare"]],
    ["Barnvakt", "Omsorg", ["barnvakt"]],
    ["Kock", "Restaurang", ["kock", "köksmästare", "pastry chef", "chef de partie"]],
    ["Pizzabagare", "Restaurang", ["pizzabagare"]],
    ["Köksbiträde", "Restaurang", ["köksbiträde", "diskare", "kökspersonal"]],
    ["Serveringspersonal", "Restaurang", ["serveringspersonal", "servitör", "servitris", "servitrice", "hovmästare", "restaurangbiträde"]],
    ["Bartender", "Restaurang", ["bartender"]],
    ["Lokalvårdare", "Service", ["lokalvårdare", "städare"]],
    ["Montör", "Industri", ["montör", "köksmontör", "verkstad"]],
    ["Snickare", "Bygg", ["snickare"]],
    ["Målare", "Bygg", ["målare"]],
    ["VVS-montör", "Bygg", ["vvs-montör", "rörmokare"]],
    ["Anläggare", "Bygg", ["anläggare", "va-anläggare", "markentreprenad"]],
    ["Elektriker", "Bygg", ["elektriker"]],
    ["Taxiförare", "Transport", ["taxiförare", "taxichaufför"]],
    ["Chaufför", "Transport", ["chaufför", "förare"]],
    ["Lagerarbetare", "Lager", ["lager", "packare", "operatör"]],
    ["Apotekare/Receptarie", "Apotek", ["apotekare", "receptarie"]],
    ["Butiksmedarbetare", "Handel", ["butik", "butiksmedarbetare"]],
    ["Medarbetare", "Övrigt", ["medarbetare", "extrapersonal", "sommarjobb"]]
  ];

  for (const [canonicalTitle, titleCategory, terms] of rules) {
    if (includesAny(text, terms)) return { canonicalTitle, titleCategory };
  }

  return { canonicalTitle: cleanFallbackTitle(title), titleCategory: "Övrigt" };
}

function classifyDeveloperTitle(roleText: string, text: string): CanonicalTitleResult | null {
  const roleValue = normalizeText(roleText);
  const value = normalizeText(text);
  if (includesAny(roleValue, ["affarsutvecklare", "verksamhetsutvecklare", "organisationsutvecklare", "produktutvecklare"])) {
    return null;
  }
  const hasDeveloperSignal = includesAny(roleValue, [
    "utvecklare",
    "developer",
    "software engineer",
    "programmerare",
    "systemutvecklare",
    ".net",
    "java",
    "javascript",
    "typescript",
    "react",
    "vue",
    "angular",
    "node",
    "backend",
    "frontend",
    "fullstack",
    "devops",
    "sre",
    "kubernetes",
    "cloud engineer"
  ]) || includesStandaloneAny(roleValue, ["sre", ".net", "c#", "c++"]);

  if (!hasDeveloperSignal) return null;

  if (includesAny(value, ["fullstack", "full stack"])) {
    return { canonicalTitle: "Fullstack Utvecklare", titleCategory: "IT" };
  }

  if (includesAny(roleValue, ["devops", "site reliability", "cloud engineer"]) || includesStandaloneAny(roleValue, ["sre"])) {
    return { canonicalTitle: "DevOps Engineer", titleCategory: "IT" };
  }

  if (includesAny(value, ["frontend", "front-end", "react", "vue", "angular", "javascript", "typescript", "css", "webbutvecklare"])) {
    return { canonicalTitle: "Frontend Utvecklare", titleCategory: "IT" };
  }

  if (includesAny(value, ["backend", "back-end", ".net", " c#", "java", "python", "node", "api", "aws", "azure", "databas", "sql"])) {
    return { canonicalTitle: "Backend Utvecklare", titleCategory: "IT" };
  }

  return { canonicalTitle: "Systemutvecklare", titleCategory: "IT" };
}

function includesStandaloneAny(text: string, needles: string[]) {
  const normalized = normalizeText(text);
  return needles.some((needle) => {
    const escaped = normalizeText(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalized);
  });
}

function cleanFallbackTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(sökes|till|i|för)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || "Övrig tjänst";
}
