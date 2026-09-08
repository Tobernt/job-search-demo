import Link from "next/link";
import { CookieSettingsPanel } from "@/components/CookieSettingsPanel";

export const metadata = {
  title: "Cookieinställningar",
  description: "Hantera cookieval och rensa lokal webbläsardata för Job Search Demo.",
  alternates: {
    canonical: "/cookieinstallningar"
  }
};

export default function CookieSettingsPage() {
  return (
    <main className="text-page">
      <Link href="/" className="back-link">Till sökningen</Link>
      <h1>Cookieinställningar</h1>
      <p>
        Här kan du ändra samtycke för annonscookies och rensa lokal webbläsardata som används för
        funktioner på Job Search Demo.
      </p>
      <CookieSettingsPanel />
      <p>
        Mer information om dataminimering, tredjepartstjänster och dina rättigheter finns i
        {" "}<Link className="plain-link" href="/integritet">integritetspolicyn</Link>.
      </p>
    </main>
  );
}
