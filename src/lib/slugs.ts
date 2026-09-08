import { swedishLocalities } from "@/data/swedish-localities";

const knownRoleLabels = [
  "AI-konsult",
  "Apotekare/Receptarie",
  "Arbetsledare",
  "Automationsingenjör",
  "Backend Utvecklare",
  "Barnskötare",
  "Barnvakt",
  "Bartender",
  "Bilvårdare",
  "BI-utvecklare",
  "Butikskonsulent",
  "Butiksmedarbetare",
  "Chaufför",
  "Customer Success Manager",
  "Dansledare",
  "Data Engineer",
  "Dental hygienist",
  "DevOps Engineer",
  "Djursjukskötare",
  "Ekonom",
  "Elektriker",
  "Frontend Utvecklare",
  "Fullstack Utvecklare",
  "Försäljningschef",
  "Frisör",
  "Gruppchef",
  "Gympersonal",
  "HR-specialist",
  "IT-support",
  "Jurist",
  "Kock",
  "Kundtjänstmedarbetare",
  "Köksbiträde",
  "Lagerarbetare",
  "Lokalvårdare",
  "Läkare",
  "Lärare",
  "Marknadsförare",
  "Medarbetare",
  "Mekaniker",
  "Montör",
  "Målare",
  "Operations Manager",
  "Personlig assistent",
  "Pizzabagare",
  "Product Manager",
  "Produktägare",
  "Produktchef",
  "Projektledare",
  "Redovisningsassistent",
  "Revisor",
  "Samordnare",
  "Serveringspersonal",
  "Sjuksköterska",
  "Snickare",
  "Språkcoach",
  "Systemadministratör",
  "Systemutvecklare",
  "Säljare",
  "Taxiförare",
  "Tolk",
  "Undersköterska",
  "Uthyrare",
  "UX/UI Designer",
  "Veterinär",
  "VVS-montör"
];

const knownSlugLabels = buildKnownSlugLabels();

export function slugToLabel(value: string) {
  const decoded = decodeURIComponent(value);
  const known = knownSlugLabels.get(toSlug(decoded));
  if (known) return known;

  return decoded
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function labelToSlug(value: string) {
  return toSlug(value);
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildKnownSlugLabels() {
  const labels = new Map<string, string>();
  const add = (label?: string) => {
    const value = label?.trim();
    if (!value) return;
    const slug = toSlug(value);
    if (slug && !labels.has(slug)) labels.set(slug, value);
  };

  for (const locality of swedishLocalities) {
    add(locality.name);
    add(locality.municipality);
    add(locality.region);
  }

  for (const role of knownRoleLabels) add(role);
  return labels;
}
