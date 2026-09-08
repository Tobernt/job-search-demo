import type { EmployerType, JobTechAd, WorkMode } from "./types";

export const CLASSIFICATION_VERSION = "rules-v2";

const STAFFING_TERMS = [
  "bemanning",
  "bemanningsforetag",
  "konsultuppdrag",
  "rekrytering",
  "recruitment",
  "consulting",
  "staffing"
];

const ATS_DOMAINS = [
  "teamtailor.com",
  "varbi.com",
  "visma.com",
  "workbuster.com",
  "jobylon.com",
  "recruto.se",
  "recman.no",
  "talentech.io",
  "reachmee.com",
  "sympahr.net",
  "easycruit.com"
];

export function normalizeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesAny(text: string, needles: string[]): boolean {
  const normalized = normalizeText(text);
  return needles.some((needle) => normalized.includes(normalizeText(needle)));
}

export function classifyWorkMode(text: string, sourceUrl?: string): {
  mode: WorkMode;
  confidence: number;
  warning?: string;
} {
  const t = normalizeText(`${text} ${sourceUrl ?? ""}`);

  const hybridStrong = [
    "hybrid",
    "hybridarbete",
    "hybridarbetssatt",
    "mojlighet till distansarbete",
    "dagar pa kontoret",
    "minst en dag pa kontoret",
    "kontoret ibland",
    "pa kontoret",
    "kontorsdagar",
    "kontorsnarvaro",
    "office first",
    "on site some days",
    "2 dagar i veckan",
    "3 dagar i veckan",
    "minimum two days a week",
    "office days"
  ];

  const remoteStrong = [
    "100% distans",
    "helt pa distans",
    "jobba hemifran",
    "arbeta hemifran",
    "arbeta pa distans",
    "distansarbete pa heltid",
    "remote first",
    "fully remote",
    "work from anywhere"
  ];

  const onsiteStrong = [
    "pa plats",
    "arbete pa plats",
    "skiftarbete",
    "butik",
    "lager",
    "vardavdelning",
    "restaurang",
    "mottagning",
    "kundbesok",
    "fysisk narvaro",
    "arbetsplatsen ar"
  ];

  if (includesAny(t, remoteStrong) && includesAny(t, hybridStrong)) {
    return {
      mode: "hybrid",
      confidence: 0.82,
      warning: "Kallan antyder distans, men annonstexten namner ocksa kontorsdagar eller kontorsnarvaro. Vi visar det som hybrid tills vidare."
    };
  }

  if (includesAny(t, hybridStrong)) return { mode: "hybrid", confidence: 0.9 };
  if (includesAny(t, remoteStrong)) return { mode: "remote", confidence: 0.85 };
  if (includesAny(t, onsiteStrong)) return { mode: "onsite", confidence: 0.72 };

  if (t.includes("distans")) {
    return {
      mode: "unclear",
      confidence: 0.45,
      warning: "Annonsen namner distans, men arbetsformen ar inte tydlig nog."
    };
  }

  return { mode: "unclear", confidence: 0.3 };
}

export function classifySalesNoise(title: string, text: string): boolean {
  const titleValue = normalizeText(title);
  const value = `${title} ${text}`;
  const guards = [
    "business analyst",
    "produktagare"
  ];

  const titleTerms = [
    "salj",
    "forsalj",
    "sales",
    "account manager",
    "account executive",
    "key account",
    "sales promoter",
    "business development representative",
    "customer service & sales",
    "kundbokare",
    "bokare"
  ];

  const salesTerms = [
    "saljare",
    "forsaljning",
    "forsaljningsassistent",
    "account manager",
    "account executive",
    "key account",
    "sales promoter",
    "sales manager",
    "area sales",
    "inside sales",
    "business oriented sales",
    "business development representative",
    "telefonforsaljning",
    "faltforsaljare",
    "door to door",
    "provisionslon",
    "kundbokare",
    "bokare"
  ];

  if (includesAny(value, guards)) return false;
  if (includesAny(titleValue, titleTerms)) return true;
  return includesAny(value, salesTerms);
}

export function classifyEmployerType(ad: JobTechAd): EmployerType {
  const employer = ad.employer?.name ?? "";
  const text = `${employer} ${ad.headline ?? ""} ${ad.description?.text ?? ""}`;

  if (includesAny(text, ["bemanning", "staffing", "konsultuthyrning"])) {
    return "staffing_agency";
  }

  if (includesAny(text, STAFFING_TERMS)) return "recruiter";
  return employer ? "direct_employer" : "unknown";
}

export function classifyApplyType(applyUrl: string, employerType: EmployerType) {
  if (!applyUrl) return "unknown";
  if (applyUrl.startsWith("mailto:")) return "email";
  if (applyUrl.includes("arbetsformedlingen.se")) return "via_af";
  if (employerType === "recruiter" || employerType === "staffing_agency") return "recruiter";

  try {
    const host = new URL(applyUrl).hostname.replace(/^www\./, "");
    if (ATS_DOMAINS.some((domain) => host.includes(domain))) return "ats";
    return "employer_site";
  } catch {
    return "unknown";
  }
}

export function classifySeniority(title: string, text: string) {
  const value = `${title} ${text}`;
  const titleOnly = normalizeText(title);
  if (includesAny(titleOnly, ["lead", "tech lead", "principal", "arkitekt", "chef", "manager"])) return "lead";
  if (includesAny(value, ["senior", "erfaren", "specialist", "minst 5 ar", "minst fem ar", "5+ ar"])) return "senior";
  if (includesAny(value, ["junior", "trainee", "nyutexaminerad"])) return "junior";
  if (includesAny(value, ["medior", "nagra ars erfarenhet", "nagot ars erfarenhet", "2 ar", "3 ar", "4 ar"])) return "medior";
  return "unclear";
}

export function extractLanguages(ad: JobTechAd, text: string): string[] {
  const labels = new Set<string>();
  const rawLanguages = [
    ...(ad.must_have?.languages ?? []),
    ...(ad.nice_to_have?.languages ?? [])
  ];

  for (const language of rawLanguages) {
    if (language.label) labels.add(language.label);
  }

  if (includesAny(text, ["svenska i tal och skrift", "goda kunskaper i svenska", "flytande svenska"])) {
    labels.add("Svenska kravs");
  }

  if (includesAny(text, ["english only", "english speaking", "engelska racker"])) {
    labels.add("Engelska racker");
  }

  if (labels.size === 0 && includesAny(text, ["engelska", "english"])) labels.add("Engelska");
  if (labels.size === 0) labels.add("Ej angivet");

  return Array.from(labels).slice(0, 4);
}

export function extractRequirementLines(ad: JobTechAd, kind: "must" | "nice"): string[] {
  const block = kind === "must" ? ad.must_have : ad.nice_to_have;
  const structured = [
    ...(block?.skills ?? []),
    ...(block?.languages ?? []),
    ...(block?.work_experiences ?? []),
    ...(block?.education ?? []),
    ...(block?.drivers_license ?? [])
  ]
    .map((item) => item.label)
    .filter(Boolean) as string[];

  const text = ad.description?.text ?? "";
  const heading =
    kind === "must"
      ? /(krav|skallkrav|maste|vi soker dig som|kvalifikationer|du har|vi vill att du)/i
      : /(meriterande|det ar meriterande|plus om|vi ser garna|onskvart|extra bra om)/i;
  const lines = text
    .replace(/\r/g, "\n")
    .split(/\n|•|- |\* |\. /)
    .map((line) => line.trim())
    .filter((line) => line.length > 10 && line.length < 150)
    .filter((line) => heading.test(normalizeText(line)))
    .slice(0, 4);

  return unique([...structured, ...lines]).slice(0, 6);
}

export function extractSalary(ad: JobTechAd): string {
  if (ad.salary_description?.trim()) return ad.salary_description.trim();
  const text = ad.description?.text ?? "";
  const match = text.match(/(\d{2,3}\s?\d{3}\s?[-–]\s?\d{2,3}\s?\d{3}\s?(kr|sek)|\d{2,3}\s?\d{3}\s?(kr|sek)\/?(man|manad|mån|månad|month)?|fast lön|fast lon|timlön|timlon|månadslön|manadslon|lön enligt avtal|lon enligt avtal|kollektivavtal)/i);
  return match?.[0] ?? "Lön ej angiven";
}

export function makePlainSummary(ad: JobTechAd): string {
  const text = (ad.description?.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sammanfattning saknas i källdatan.";
  return text.length > 240 ? `${text.slice(0, 237).trim()}...` : text;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
