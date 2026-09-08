import type { Metadata } from "next";
import { CookieConsent } from "@/components/CookieConsent";
import { getAdSenseClientId } from "@/lib/adsense";
import { normalizeSiteUrl } from "@/lib/site-url";
import "./globals.css";

const adsenseClientId = getAdSenseClientId();
const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL);
const clientErrorReporterScript = `
(function () {
  if (window.__jobsearchdemoClientErrorReporterInstalled) return;
  window.__jobsearchdemoClientErrorReporterInstalled = true;
  var seen = {};
  function text(value, fallback) {
    if (typeof value === "string" && value) return value;
    return fallback || "";
  }
  function send(payload) {
    try {
      payload.path = window.location.href;
      payload.userAgent = navigator.userAgent;
      payload.viewport = window.innerWidth + "x" + window.innerHeight;
      var key = [payload.type, payload.message, payload.source, payload.line, payload.column].join("|");
      if (seen[key]) return;
      seen[key] = true;
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/client-error", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (_) {}
  }
  window.addEventListener("error", function (event) {
    send({
      type: "error",
      message: text(event.message, "Unknown client error"),
      stack: event.error && event.error.stack ? String(event.error.stack) : "",
      source: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0
    });
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    send({
      type: "unhandledrejection",
      message: reason && reason.message ? String(reason.message) : text(String(reason || ""), "Unhandled promise rejection"),
      stack: reason && reason.stack ? String(reason.stack) : ""
    });
  });
})();
`;

export const metadata: Metadata = {
  title: {
    default: "Lediga jobb i Sverige | Job Search Demo",
    template: "%s | Job Search Demo"
  },
  description: "Sök publika jobbannonser i Sverige med filter för ort, arbetsform, omfattning och annonser där lön anges.",
  applicationName: "Job Search Demo",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/icon.svg", sizes: "48x48", type: "image/svg+xml" },
      { url: "/icon.svg", sizes: "512x512", type: "image/svg+xml" }
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/icon.svg", sizes: "180x180", type: "image/svg+xml" }
    ]
  },
  openGraph: {
    title: "Lediga jobb i Sverige | Job Search Demo",
    description: "Sök publika jobbannonser i Sverige med filter för ort, arbetsform, omfattning och annonser där lön anges.",
    url: siteUrl,
    siteName: "Job Search Demo",
    locale: "sv_SE",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Job Search Demo",
    alternateName: ["Lediga jobb portalen", "jobsearchdemo"],
    url: siteUrl,
    inLanguage: "sv-SE",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Job Search Demo",
    url: siteUrl
  };

  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content={adsenseClientId} />
        <script dangerouslySetInnerHTML={{ __html: clientErrorReporterScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script src="/theme-init.js" />
      </head>
      <body>
        {children}
        <footer className="site-footer" aria-label="Sidfot">
          <div>
            <strong>Job Search Demo</strong>
            <span>Oberoende jobbsökning med tydligt märkta annonser och externa ansökningslänkar.</span>
          </div>
          <nav aria-label="Juridik och annonser">
            <a href="/cookieinstallningar">Cookieinställningar</a>
            <a href="/integritet">Integritet</a>
            <a href="/villkor">Villkor</a>
            <a href="/annonser">Annons- och transparenspolicy</a>
            <a href="/distansjobb">Distansjobb</a>
          </nav>
        </footer>
        <CookieConsent />
      </body>
    </html>
  );
}
