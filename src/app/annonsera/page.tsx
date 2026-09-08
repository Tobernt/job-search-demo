import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PauseCircle, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Annonsera",
  description: "Annons- och sponsorintag är pausat på Job Search Demo.",
  alternates: {
    canonical: "/annonsera"
  },
  robots: {
    index: false,
    follow: true
  }
};

export default async function AdvertisePage({
  searchParams
}: {
  searchParams?: Promise<{ produkt?: string; product?: string; sku?: string }>;
}) {
  const params = await searchParams;
  const legacyProduct = cleanParam(params?.produkt ?? params?.product ?? params?.sku);

  return (
    <main className="advertise-page">
      <Link href="/" className="back-link"><ArrowLeft size={18} /> Till sökningen</Link>

      <section className="pricing-hero">
        <div>
          <span className="sponsor-label">Intag pausat</span>
          <h1>Vi tar inte emot annonsmaterial</h1>
          <p>
            Sponsor- och partnerintag är avstängt för att hålla projektet passivt. Nya betalningar,
            annonsformulär och manuella publiceringsärenden skapas inte från webbplatsen.
          </p>
          <div className="pricing-actions">
            <Link className="apply-button" href="/">
              Gå till jobbsökningen <ArrowRight size={17} />
            </Link>
            <Link className="plain-link" href="/annonser">
              Läs annonsprinciperna
            </Link>
          </div>
        </div>
        <div className="liability-panel">
          <ShieldCheck size={22} />
          <strong>Ingen kund- eller kandidatdata</strong>
          <p>Skicka inte CV:n, ansökningar, betaluppgifter, lösenord eller kampanjmaterial.</p>
        </div>
      </section>

      {legacyProduct ? (
        <section className="selected-product-note" aria-label="Pausad länk">
          <span>Gammal paketlänk</span>
          <strong>{legacyProduct}</strong>
          <small>Det här paketet är pausat och kan inte köpas eller skickas in.</small>
        </section>
      ) : null}

      <section className="embedded-form-shell" aria-label="Annonsintag pausat">
        <div className="newsletter-fallback">
          <PauseCircle size={24} />
          <p>
            Google-servade annonser är pausade under policygranskning. Förkonfigurerade affiliate- eller resurslänkar
            kan användas först när de är relevanta, tydligt märkta och inte ersätter sidans huvudinnehåll.
          </p>
        </div>
      </section>
    </main>
  );
}

function cleanParam(value?: string) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}
