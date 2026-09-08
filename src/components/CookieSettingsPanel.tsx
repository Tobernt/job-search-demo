"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "cookie_consent_approved";
const LOCAL_PREFIXES = ["jobsearchdemo.", "jobsearchdemo."];

export function CookieSettingsPanel() {
  const useGoogleCmp = process.env.NEXT_PUBLIC_ADSENSE_USE_GOOGLE_CMP === "true";
  const [adConsent, setAdConsent] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    syncConsentState();
    window.addEventListener("cookie-consent-changed", syncConsentState);
    return () => window.removeEventListener("cookie-consent-changed", syncConsentState);
  }, []);

  function syncConsentState() {
    const value = window.localStorage.getItem(CONSENT_KEY);
    setHasChoice(value !== null);
    setAdConsent(value === "true");
  }

  function allowAds() {
    window.localStorage.setItem(CONSENT_KEY, "true");
    window.dispatchEvent(new Event("cookie-consent-changed"));
    setMessage("Annonscookies är godkända.");
  }

  function onlyNecessary() {
    window.localStorage.setItem(CONSENT_KEY, "false");
    window.dispatchEvent(new Event("cookie-consent-changed"));
    setMessage("Endast nödvändiga och lokala funktionsval används.");
  }

  function showBannerAgain() {
    window.localStorage.removeItem(CONSENT_KEY);
    window.dispatchEvent(new Event("cookie-consent-changed"));
    setMessage("Cookievalet är återställt. Popupen visas igen.");
  }

  function clearLocalData() {
    removeStorageKeys(window.localStorage);
    removeStorageKeys(window.sessionStorage);
    clearFirstPartyCookies();
    window.dispatchEvent(new Event("cookie-consent-changed"));
    syncConsentState();
    setMessage("Lokala val, jobbhistorik, sparade sökningar och förstapartscookies har rensats.");
  }

  return (
    <section className="cookie-settings-panel" aria-label="Cookieinställningar">
      <div>
        <strong>Nuvarande val</strong>
        <p>
          {useGoogleCmp
            ? "Annonsmedgivande hanteras av Googles certifierade samtyckesmeddelande."
            : hasChoice
              ? (adConsent ? "Annonscookies är godkända." : "Endast nödvändigt är valt.")
              : "Inget cookieval är sparat ännu."}
        </p>
      </div>
      <div className="settings-actions">
        {!useGoogleCmp ? (
          <>
            <button type="button" onClick={onlyNecessary}>Endast nödvändigt</button>
            <button type="button" onClick={allowAds}>Godkänn annonser</button>
            <button type="button" onClick={showBannerAgain}>Visa popup igen</button>
          </>
        ) : null}
        <button type="button" onClick={clearLocalData}>Rensa cookies och lokal data</button>
      </div>
      <p>
        Knappen rensar Job Search Demos lokala webbläsardata: sparade jobb, sparade sökningar,
        historik, tema och cookieval. Tredjepartscookies och Googles samtycke rensas i webbläsarens
        egna inställningar.
      </p>
      {message ? <p className="settings-message" role="status">{message}</p> : null}
    </section>
  );
}

function removeStorageKeys(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (key === CONSENT_KEY || LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

function clearFirstPartyCookies() {
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
  }
}
