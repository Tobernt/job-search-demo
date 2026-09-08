import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BellOff, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Jobbaviseringar",
  description: "E-postaviseringar är pausade på Job Search Demo.",
  alternates: {
    canonical: "/jobbaviseringar"
  },
  robots: {
    index: false,
    follow: true
  }
};

export default function JobAlertsPage() {
  return (
    <main className="advertise-page">
      <Link href="/" className="back-link"><ArrowLeft size={18} /> Till jobbsökningen</Link>

      <section className="pricing-hero">
        <div>
          <span className="sponsor-label">Pausat</span>
          <h1>Jobbaviseringar via e-post är pausade</h1>
          <p>
            E-postutskick och prenumerationslistor är avstängda för att hålla projektet passivt och minimera
            personuppgiftshantering. Du kan fortfarande spara sökningar lokalt i webbläsaren.
          </p>
          <div className="pricing-actions">
            <Link className="apply-button" href="/">
              Gå till jobbsökningen <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="liability-panel">
          <ShieldCheck size={22} />
          <strong>Ingen e-postlista</strong>
          <p>Job Search Demo tar inte emot nya prenumerationer eller lagrar nyhetsbrevsadresser.</p>
        </div>
      </section>

      <section className="embedded-form-shell newsletter-form-shell" aria-label="Jobbaviseringar pausade">
        <div className="newsletter-fallback">
          <BellOff size={24} />
          <p>
            Använd sparade sökningar i sökpanelen för lokal bevakning. Funktionen skickar inga e-postmeddelanden
            och kräver inget konto.
          </p>
        </div>
      </section>
    </main>
  );
}
