import Link from "next/link";

export const metadata = {
  title: "Partner och sponsring",
  description: "Nuvarande partnerläge: passiva annons- och affiliateytor utan publikt sponsorintag.",
  alternates: {
    canonical: "/for-partners"
  },
  robots: {
    index: false,
    follow: true
  }
};

export default function PartnersPage() {
  return (
    <main className="text-page">
      <Link href="/" className="back-link">Till sökningen</Link>
      <h1>Partner och sponsring</h1>
      <p>
        Job Search Demo kör ads/affiliate-only. Vi tar inte emot nya sponsorbeställningar eller
        kampanjmaterial via webbplatsen.
      </p>

      <h2>Aktivt nu</h2>
      <ul>
        <li>Google AdSense-verifiering finns kvar, men automatiska annonsytor är pausade under policygranskning.</li>
        <li>Förkonfigurerade affiliate- eller resurslänkar för relevanta jobbsökartjänster.</li>
        <li>Tydlig märkning när en länk eller yta är annons, partner eller sponsrad.</li>
      </ul>

      <h2>Pausat</h2>
      <ul>
        <li>Sålda sponsorplatser.</li>
        <li>Nyhetsbrevssponsring.</li>
        <li>Direktjobb och arbetsgivarprofiler.</li>
        <li>Arbetsgivarrapporter och löpande bevakningar.</li>
        <li>Anpassade kampanjer som kräver daglig uppföljning.</li>
      </ul>

      <h2>Principer</h2>
      <ul>
        <li>Organisk jobbranking säljs inte.</li>
        <li>Inga popups, popunders eller dolda omvägar.</li>
        <li>Ingen kandidatdata, CV:n eller ansökningar samlas in.</li>
        <li>Betalda flöden öppnas inte igen förrän de kan drivas med låg risk och låg handpåläggning.</li>
      </ul>

      <p>
        Läs mer på <Link className="plain-link" href="/annonser">annons- och transparenspolicyn</Link>.
      </p>
    </main>
  );
}
