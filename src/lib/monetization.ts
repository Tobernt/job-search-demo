export type MonetizationProductType =
  | "job_post"
  | "employer_report"
  | "employer_monitoring"
  | "employer_profile"
  | "sponsor_slot"
  | "newsletter_sponsorship"
  | "affiliate_placement";

export type BillingMode = "one_time" | "monthly" | "prepaid";
export type MonetizationMode = "ads_affiliate" | "passive" | "manual" | "full";
export type MonetizationProductAvailability = "passive" | "manual";

export interface MonetizationProduct {
  sku: string;
  productType: MonetizationProductType;
  billingMode: BillingMode;
  availability: MonetizationProductAvailability;
  title: string;
  priceSek: number;
  priceSuffix: string;
  description: string;
  features: string[];
  stripePaymentLinkEnv: string;
  filloutFormEnv: string;
  recommended?: boolean;
}

export interface MonetizationProductView extends MonetizationProduct {
  stripePaymentUrl: string;
  filloutFormUrl: string;
  mode: MonetizationMode;
  available: boolean;
}

export const monetizationProducts: MonetizationProduct[] = [
  {
    sku: "job-post-30",
    productType: "job_post",
    billingMode: "one_time",
    availability: "manual",
    title: "Jobbannons 30 dagar",
    priceSek: 299,
    priceSuffix: "engångsbetalning",
    description: "Lägg upp ett jobb som leder vidare till er egen ansökningssida.",
    features: ["30 dagar", "Extern ansökningslänk krävs", "Ingen insamling av ansökningar"],
    stripePaymentLinkEnv: "STRIPE_LINK_JOB_POST_30",
    filloutFormEnv: "FILLOUT_JOB_POST_FORM_URL"
  },
  {
    sku: "job-post-quality",
    productType: "job_post",
    billingMode: "one_time",
    availability: "manual",
    title: "Jobbannons + kvalitetscheck",
    priceSek: 495,
    priceSuffix: "engångsbetalning",
    description: "Lägg upp ett jobb och få en snabb kontroll av länk, arbetsform, lön, deadline och tydlighet.",
    features: ["30 dagar", "Kort kvalitetscheck", "Publiceras efter granskning"],
    stripePaymentLinkEnv: "STRIPE_LINK_JOB_POST_QUALITY",
    filloutFormEnv: "FILLOUT_JOB_POST_FORM_URL",
    recommended: true
  },
  {
    sku: "employer-report",
    productType: "employer_report",
    billingMode: "one_time",
    availability: "manual",
    title: "Rapport om era jobbannonser",
    priceSek: 495,
    priceSuffix: "engångsbetalning",
    description: "Se var era publika jobbannonser kan bli tydligare för jobbsökare.",
    features: ["Länkar, dubletter och tydlighet", "Bygger på publika annonser", "Ingen kandidatdata"],
    stripePaymentLinkEnv: "STRIPE_LINK_EMPLOYER_REPORT",
    filloutFormEnv: "FILLOUT_EMPLOYER_REPORT_FORM_URL"
  },
  {
    sku: "employer-monitoring-monthly",
    productType: "employer_monitoring",
    billingMode: "monthly",
    availability: "manual",
    title: "Bevakning av era jobbannonser",
    priceSek: 695,
    priceSuffix: "per månad",
    description: "Månadsvis kontroll av era publika jobbannonser och ansökningslänkar.",
    features: ["Månadsvis kontroll", "Ingen lokal kundinloggning", "Manuell uppföljning krävs"],
    stripePaymentLinkEnv: "STRIPE_LINK_EMPLOYER_MONITORING_MONTHLY",
    filloutFormEnv: "FILLOUT_EMPLOYER_MONITORING_FORM_URL"
  },
  {
    sku: "employer-monitoring-prepaid",
    productType: "employer_monitoring",
    billingMode: "prepaid",
    availability: "manual",
    title: "Bevakning 3 månader",
    priceSek: 1795,
    priceSuffix: "för 3 månader",
    description: "Förbetald kontroll av era publika jobbannonser under tre månader.",
    features: ["Ingen automatisk förnyelse", "Publika jobbdata endast", "Granskning varje månad"],
    stripePaymentLinkEnv: "STRIPE_LINK_EMPLOYER_MONITORING_PREPAID",
    filloutFormEnv: "FILLOUT_EMPLOYER_MONITORING_FORM_URL"
  },
  {
    sku: "verified-profile-monthly",
    productType: "employer_profile",
    billingMode: "monthly",
    availability: "manual",
    title: "Arbetsgivarprofil",
    priceSek: 299,
    priceSuffix: "per månad",
    description: "Visa en kort publik företagspresentation bredvid era aktuella jobb.",
    features: ["Publik profil", "Länk från relevanta jobb", "Ingen kandidatkontakt här"],
    stripePaymentLinkEnv: "STRIPE_LINK_VERIFIED_PROFILE_MONTHLY",
    filloutFormEnv: "FILLOUT_EMPLOYER_PROFILE_FORM_URL"
  },
  {
    sku: "verified-profile-prepaid",
    productType: "employer_profile",
    billingMode: "prepaid",
    availability: "manual",
    title: "Arbetsgivarprofil 3 månader",
    priceSek: 795,
    priceSuffix: "för 3 månader",
    description: "Förbetald arbetsgivarprofil under tre månader.",
    features: ["Publik profil", "Ingen automatisk förnyelse", "Publiceras efter granskning"],
    stripePaymentLinkEnv: "STRIPE_LINK_VERIFIED_PROFILE_PREPAID",
    filloutFormEnv: "FILLOUT_EMPLOYER_PROFILE_FORM_URL"
  },
  {
    sku: "category-sponsor-monthly",
    productType: "sponsor_slot",
    billingMode: "monthly",
    availability: "passive",
    title: "Kategorisponsor",
    priceSek: 995,
    priceSuffix: "per månad",
    description: "Syns i en relevant kategori, till exempel distansjobb, utbildning eller a-kassa.",
    features: ["Kategori eller arbetsform", "Tydligt märkt sponsorplats", "Organisk ranking säljs inte"],
    stripePaymentLinkEnv: "STRIPE_LINK_CATEGORY_SPONSOR_MONTHLY",
    filloutFormEnv: "FILLOUT_SPONSOR_FORM_URL"
  },
  {
    sku: "category-sponsor-prepaid",
    productType: "sponsor_slot",
    billingMode: "prepaid",
    availability: "passive",
    title: "Kategorisponsor 3 mån",
    priceSek: 2500,
    priceSuffix: "för 3 månader",
    description: "Förbetald sponsorplats i en relevant kategori under tre månader.",
    features: ["Fast period", "Tydligt märkt sponsorplats", "Copy granskas före publicering"],
    stripePaymentLinkEnv: "STRIPE_LINK_CATEGORY_SPONSOR_PREPAID",
    filloutFormEnv: "FILLOUT_SPONSOR_FORM_URL"
  },
  {
    sku: "national-sponsor-monthly",
    productType: "sponsor_slot",
    billingMode: "monthly",
    availability: "passive",
    title: "Nationell sponsor",
    priceSek: 1995,
    priceSuffix: "per månad",
    description: "Syns bredare för jobbsökare i Sverige med en tydligt märkt sponsorplats.",
    features: ["Nationell placering", "Tydligt märkt sponsorplats", "Inga popups eller dolda omvägar"],
    stripePaymentLinkEnv: "STRIPE_LINK_NATIONAL_SPONSOR_MONTHLY",
    filloutFormEnv: "FILLOUT_SPONSOR_FORM_URL"
  },
  {
    sku: "national-sponsor-prepaid",
    productType: "sponsor_slot",
    billingMode: "prepaid",
    availability: "passive",
    title: "Nationell sponsor 3 mån",
    priceSek: 5000,
    priceSuffix: "för 3 månader",
    description: "Förbetald nationell sponsorplats under tre månader.",
    features: ["Fast period", "Tydligt märkt sponsorplats", "Publiceras efter granskning"],
    stripePaymentLinkEnv: "STRIPE_LINK_NATIONAL_SPONSOR_PREPAID",
    filloutFormEnv: "FILLOUT_SPONSOR_FORM_URL"
  },
  {
    sku: "newsletter-sponsor",
    productType: "newsletter_sponsorship",
    billingMode: "one_time",
    availability: "manual",
    title: "Nyhetsbrevssponsor",
    priceSek: 500,
    priceSuffix: "per utskick",
    description: "Köp ett tydligt märkt sponsorblock i kommande utskick.",
    features: ["Tydlig annonsmärkning", "Kräver separat utskicksverktyg", "Ingen e-postlista i appen"],
    stripePaymentLinkEnv: "STRIPE_LINK_NEWSLETTER_SPONSOR",
    filloutFormEnv: "FILLOUT_NEWSLETTER_SPONSOR_FORM_URL"
  },
  {
    sku: "affiliate-placement",
    productType: "affiliate_placement",
    billingMode: "one_time",
    availability: "passive",
    title: "Partnerlänk",
    priceSek: 495,
    priceSuffix: "startavgift",
    description: "För relevanta tjänster som hjälper jobbsökare, till exempel a-kassa, utbildning eller karriärstöd.",
    features: ["Tydlig märkning", "Ingen rankingpåverkan", "Placering efter relevans"],
    stripePaymentLinkEnv: "STRIPE_LINK_AFFILIATE_PLACEMENT",
    filloutFormEnv: "FILLOUT_AFFILIATE_FORM_URL"
  }
];

export function getMonetizationMode(): MonetizationMode {
  const value = process.env.MONETIZATION_MODE?.trim().toLowerCase();
  if (value === "ads_affiliate" || value === "ads-affiliate") return "ads_affiliate";
  if (value === "manual" || value === "full") return value;
  if (value === "passive") return "passive";
  return "ads_affiliate";
}

export function isPassiveProduct(product: MonetizationProduct) {
  return product.availability === "passive";
}

export function isProductAvailable(product: MonetizationProduct, mode: MonetizationMode = getMonetizationMode()) {
  if (mode === "ads_affiliate") return false;
  if (mode === "passive") return isPassiveProduct(product);
  return true;
}

export function getConfiguredMonetizationProducts(options: { includePaused?: boolean } = {}): MonetizationProductView[] {
  const mode = getMonetizationMode();
  return monetizationProducts
    .filter((product) => options.includePaused || isProductAvailable(product, mode))
    .map((product) => ({
      ...product,
      mode,
      available: isProductAvailable(product, mode),
      stripePaymentUrl: configuredUrl(product.stripePaymentLinkEnv),
      filloutFormUrl: configuredUrl(product.filloutFormEnv) || configuredUrl("FILLOUT_DEFAULT_FORM_URL")
    }));
}

export function getPausedMonetizationProducts() {
  const mode = getMonetizationMode();
  return monetizationProducts.filter((product) => !isProductAvailable(product, mode));
}

export function getProductBySku(sku: string) {
  return monetizationProducts.find((product) => product.sku === sku);
}

export function getAvailableProductBySku(sku: string) {
  const product = getProductBySku(sku);
  return product && isProductAvailable(product) ? product : undefined;
}

export function formatSek(value: number) {
  return `${value.toLocaleString("sv-SE")} SEK`;
}

export function productTypeLabel(value: MonetizationProductType | string) {
  return {
    job_post: "Jobbannons",
    employer_report: "Kvalitetsrapport",
    employer_monitoring: "Arbetsgivarbevakning",
    employer_profile: "Arbetsgivarprofil",
    sponsor_slot: "Sponsorplats",
    newsletter_sponsorship: "Nyhetsbrevssponsor",
    affiliate_placement: "Partnerplacering"
  }[value] ?? "Okänd produkt";
}

export function billingModeLabel(value: BillingMode | string) {
  return {
    one_time: "Engångsbetalning",
    monthly: "Månad",
    prepaid: "Förbetalt"
  }[value] ?? "Okänt upplägg";
}

export function productAvailabilityLabel(value: MonetizationProductAvailability | string) {
  return {
    passive: "Passiv",
    manual: "Pausad i passivt läge"
  }[value] ?? "Okänt läge";
}

function configuredUrl(envKey: string) {
  const value = process.env[envKey]?.trim() ?? "";
  if (!value) return "";
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}
