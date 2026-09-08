const categoryIntentRules = [
  {
    categories: ["IT"],
    aliases: [
      "it",
      "tech",
      "teknik",
      "utvecklare",
      "developer",
      "developers",
      "systemutvecklare",
      "programmerare",
      "software engineer",
      "frontend",
      "backend",
      "fullstack",
      "full stack",
      "devops",
      "sre",
      "data engineer",
      "bi",
      "business intelligence"
    ],
    roleTerms: [
      "utvecklare",
      "developer",
      "systemutvecklare",
      "programmerare",
      "software engineer",
      "frontend",
      "backend",
      "fullstack",
      "full stack",
      "devops",
      "sre",
      "data engineer",
      "bi",
      "business intelligence"
    ]
  },
  {
    categories: ["IT"],
    aliases: [
      "ux",
      "ui",
      "ui ux",
      "ux ui",
      "ui/ux",
      "ux designer",
      "ui designer",
      "ui ux designer",
      "ux ui designer",
      "product designer",
      "produktdesigner",
      "interaktionsdesigner",
      "digital designer"
    ],
    roleTerms: [
      "ux",
      "ui",
      "ui ux",
      "ux ui",
      "user experience",
      "user interface",
      "product designer",
      "produktdesigner",
      "interaktionsdesigner",
      "digital designer"
    ],
    requireRoleMatch: true
  },
  { categories: ["Vard"], aliases: ["vard", "sjukvard", "sjukskoterska", "underskoterska", "lakare"] },
  { categories: ["Ekonomi"], aliases: ["ekonomi", "ekonom", "controller", "redovisning", "redovisningsekonom", "revisor"] },
  { categories: ["Lager"], aliases: ["lager", "lagerjobb", "lagerarbetare", "packare"] },
  { categories: ["Bygg"], aliases: ["bygg", "snickare", "malare", "elektriker", "vvs"] },
  { categories: ["Transport"], aliases: ["transport", "chauffor", "forare", "taxi"] },
  { categories: ["Restaurang"], aliases: ["restaurang", "kock", "servering", "bartender"] },
  { categories: ["HR"], aliases: ["hr", "human resources", "rekryterare", "talent acquisition"] },
  { categories: ["Juridik"], aliases: ["juridik", "jurist", "advokat"] },
  { categories: ["Marknad"], aliases: ["marknad", "marknadsforing", "marketing", "kommunikation", "content"] },
  { categories: ["Administration"], aliases: ["administration", "administratör", "administrator", "samordnare", "koordinator"] },
  { categories: ["Service"], aliases: ["service", "kundtjanst", "customer service", "support"] },
  { categories: ["Utbildning"], aliases: ["utbildning", "larare", "pedagog", "forskollarare"] },
  { categories: ["Handel"], aliases: ["handel", "butik", "butiksmedarbetare", "butikssaljare"] },
  { categories: ["Omsorg"], aliases: ["omsorg", "personlig assistent", "barnvakt"] },
  { categories: ["Apotek"], aliases: ["apotek", "apotekare", "receptarie"] },
  { categories: ["Djurvard"], aliases: ["djurvard", "veterinar", "djursjukskotare"] },
  { categories: ["Projektledning"], aliases: ["projektledning", "projektledare", "project manager"] },
  { categories: ["Ledning"], aliases: ["ledning", "chef", "manager", "arbetsledare", "team leader"] },
  { categories: ["Forsaljning"], aliases: ["salj", "saljare", "forsaljning", "sales", "account manager"] }
];

const fillerWords = new Set([
  "jobb",
  "job",
  "jobs",
  "lediga",
  "ledig",
  "inom",
  "som",
  "for",
  "att",
  "med",
  "och"
]);

export function buildSearchIntent(rawQuery) {
  const query = normalizeIntentText(rawQuery);
  if (!query) {
    return {
      categories: [],
      hasIntent: false,
      requireRoleMatch: false,
      roleTerms: [],
      strict: false
    };
  }

  const compactQuery = removeFillerWords(query);
  const categories = new Set();
  const roleTerms = new Set();
  let exactAliasMatch = false;
  let requireRoleMatch = false;

  for (const rule of categoryIntentRules) {
    const aliases = rule.aliases.map(normalizeIntentText);
    const matched = aliases.some((alias) => queryHasAlias(query, alias) || queryHasAlias(compactQuery, alias));
    if (!matched) continue;

    for (const category of rule.categories) categories.add(normalizeIntentText(category));
    for (const term of [...(rule.roleTerms ?? []), ...rule.aliases]) roleTerms.add(normalizeIntentText(term));
    requireRoleMatch = requireRoleMatch || Boolean(rule.requireRoleMatch);
    exactAliasMatch = exactAliasMatch || aliases.some((alias) => compactQuery === alias || query === alias);
  }

  return {
    categories: Array.from(categories),
    hasIntent: categories.size > 0 || roleTerms.size > 0,
    requireRoleMatch,
    roleTerms: Array.from(roleTerms),
    strict: exactAliasMatch || (query.length <= 4 && (categories.size > 0 || roleTerms.size > 0))
  };
}

export function normalizeIntentText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeFillerWords(value) {
  return value
    .split(" ")
    .filter((token) => token && !fillerWords.has(token))
    .join(" ");
}

function queryHasAlias(query, alias) {
  if (!query || !alias) return false;
  if (alias.length <= 3) return hasStandaloneToken(query, alias);
  return query.includes(alias);
}

function hasStandaloneToken(value, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(value);
}
