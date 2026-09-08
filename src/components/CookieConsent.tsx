"use client";

import { isGoogleAdSenseCmpEnabled } from "@/lib/adsense";
import Link from "next/link";
import { useEffect, useState } from "react";

const CONSENT_KEY = "cookie_consent_approved";

export function CookieConsent() {
  const useGoogleCmp = isGoogleAdSenseCmpEnabled();
  const [ready, setReady] = useState(false);
  const [storedChoice, setStoredChoice] = useState<string | null>(null);

  useEffect(() => {
    if (useGoogleCmp) return;

    function syncChoice() {
      setStoredChoice(window.localStorage.getItem(CONSENT_KEY));
    }

    syncChoice();
    setReady(true);
    window.addEventListener("cookie-consent-changed", syncChoice);
    return () => window.removeEventListener("cookie-consent-changed", syncChoice);
  }, [useGoogleCmp]);

  function accept() {
    window.localStorage.setItem(CONSENT_KEY, "true");
    window.dispatchEvent(new Event("cookie-consent-changed"));
    setStoredChoice("true");
  }

  function decline() {
    window.localStorage.setItem(CONSENT_KEY, "false");
    window.dispatchEvent(new Event("cookie-consent-changed"));
    setStoredChoice("false");
  }

  if (useGoogleCmp || !ready || storedChoice !== null) return null;

  return (
    <section className="cookie-consent" aria-label="Cookie- och integritetsval">
      <div>
        <strong>Cookies och lokal data</strong>
        <p>
          Vi sparar jobbhistorik, sparade sökningar och tema lokalt i din webbläsare. Vi sparar inte
          CV:n, ansökningar, konton eller kortuppgifter. Tredjepartsskript för annonser laddas bara om du godkänner det.
          Du kan rensa lokala val under Cookieinställningar. <Link href="/integritet">Läs mer</Link>.
        </p>
      </div>
      <div>
        <button type="button" onClick={decline}>Endast nödvändigt</button>
        <button type="button" onClick={accept}>Godkänn annonser</button>
      </div>
    </section>
  );
}
