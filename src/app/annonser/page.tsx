import Link from "next/link";

export const metadata = {
  title: "Annons- och transparenspolicy",
  description: "Hur annonser, affiliate-länkar och betalda placeringar märks på Job Search Demo.",
  alternates: {
    canonical: "/annonser"
  }
};

export default function AdsPolicyPage() {
  return (
    <main className="text-page">
      <Link href="/" className="back-link">Till sökningen</Link>
      <h1>Annons- och transparenspolicy</h1>
      <p>
        Job Search Demo ska kunna finansieras utan att sälja organisk ranking, dölja reklam
        eller samla in kandidatdata.
      </p>

      <h2>Grundregler</h2>
      <ul>
        <li>Annonser, sponsrade ytor och affiliate-länkar märks tydligt.</li>
        <li>Organiska jobbresultat påverkas inte av betalning.</li>
        <li>Ansök-knappen ska gå till en relevant extern ansökningssida.</li>
        <li>Betalda placeringar får inte kräva konto hos Job Search Demo.</li>
        <li>Vi säljer inte CV:n, kandidatprofiler, ansökningar eller personuppgifter.</li>
      </ul>

      <h2>Nuvarande intäktsmodell</h2>
      <p>
        Webbplatsen kör ads/affiliate-only. Inga nya jobbannonser, arbetsgivarprofiler, rapporter,
        sponsorplatser eller nyhetsbrevssponsringar säljs från webbplatsen.
      </p>
      <p>
        Google AdSense är pausat under policygranskning. Förkonfigurerade affiliate- eller resurslänkar kan användas
        för relevanta tjänster när de är tydligt märkta. Gamla paketlänkar är pausade och ska inte skapa betalningar,
        formulärsvar eller kundärenden.
      </p>

      <h2>Annonsnätverk</h2>
      <p>
        Job Search Demo kan använda Google AdSense för annonsytor efter godkänd granskning. Popups, popunders,
        pushannonser, mellansidor och dolda omdirigeringar används inte som standard på webbplatsen.
      </p>

      <h2>Accepterade annonskategorier</h2>
      <p>
        Relevanta och tydligt märkta annonser kan handla om exempelvis a-kassa, fackförbund,
        inkomstförsäkring, utbildning, onlinekurser, YH-studier, intervjuträning, rekrytering, employer branding eller
        andra tjänster som är relevanta för jobbsökare och arbetsgivare.
      </p>

      <h2>Ej accepterat</h2>
      <ul>
        <li>Vilseledande påståenden, falska arbetsgivarsidor eller otydliga avsändare.</li>
        <li>Reklam som ser ut som vanliga jobbannonser utan tydlig märkning.</li>
        <li>Betalda jobb som samlar ansökningar, CV:n eller kandidatmeddelanden hos Job Search Demo.</li>
        <li>Innehåll som bryter mot lag, diskriminerar eller vilseleder jobbsökare.</li>
        <li>Placeringar som antyder att annonsören kan köpa bättre organisk ranking.</li>
      </ul>

      <h2>Granskning och ändringar</h2>
      <p>
        Annons- och affiliateytor kan nekas, pausas eller justeras om innehållet är felaktigt, vilseledande,
        olagligt, irrelevant eller strider mot dessa regler. Sponsrade placeringar ska vara separerade
        från den organiska jobbsökningen.
      </p>

      <p className="text-page-note">Senast uppdaterad: 1 juni 2026.</p>
    </main>
  );
}
