"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { SponsorAd, SponsorPlacement } from "@/lib/sponsors";

export function SponsorCard({
  sponsor,
  placement,
  compact = false,
  variant = "card"
}: {
  sponsor?: SponsorAd;
  placement: SponsorPlacement;
  compact?: boolean;
  variant?: "card" | "resource";
}) {
  const [creativeIndex, setCreativeIndex] = useState(0);
  const creativeOptions = useMemo(() => {
    if (!sponsor) return [];
    if (sponsor.creativeVariants?.length) return sponsor.creativeVariants;
    if (!sponsor.imageUrl) return [];
    return [
      {
        id: "default",
        imageUrl: sponsor.imageUrl,
        imageAlt: sponsor.imageAlt
      }
    ];
  }, [sponsor]);

  useEffect(() => {
    if (!sponsor) return;

    const payload = JSON.stringify({ sponsorId: sponsor.id, placement });
    navigator.sendBeacon?.("/api/sponsor-impression", new Blob([payload], { type: "application/json" })) ||
      fetch("/api/sponsor-impression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => undefined);
  }, [placement, sponsor]);

  useEffect(() => {
    if (creativeOptions.length <= 1) {
      setCreativeIndex(0);
      return;
    }

    const randomValue = new Uint32Array(1);
    window.crypto?.getRandomValues(randomValue);
    const fallbackValue = Math.floor(Math.random() * creativeOptions.length);
    setCreativeIndex((randomValue[0] || fallbackValue) % creativeOptions.length);
  }, [creativeOptions.length, placement, sponsor?.id]);

  if (!sponsor) return null;

  const selectedCreative = creativeOptions[creativeIndex] ?? creativeOptions[0];
  const params = new URLSearchParams({ placement });
  if (selectedCreative?.id && selectedCreative.id !== "default") params.set("creative", selectedCreative.id);
  const href = `/sponsor/${sponsor.id}?${params.toString()}`;
  const hasMedia = Boolean(selectedCreative?.imageUrl);

  return (
    <aside
      className={`sponsor-card ${compact ? "compact" : ""} ${variant} ${hasMedia ? "has-media" : ""}`}
      aria-label={`${sponsor.label}: ${sponsor.headline}`}
    >
      {selectedCreative?.imageUrl ? (
        <a className="sponsor-card-media" href={href} target="_blank" rel="nofollow noopener noreferrer" aria-label={sponsor.cta}>
          <img src={selectedCreative.imageUrl} alt={selectedCreative.imageAlt ?? ""} loading="lazy" />
        </a>
      ) : null}
      <span className="sponsor-label">{sponsor.label}</span>
      <div>
        <strong>{sponsor.headline}</strong>
        <p>{sponsor.body}</p>
      </div>
      <a href={href} target="_blank" rel="nofollow noopener noreferrer">
        {sponsor.cta} <ExternalLink size={15} />
      </a>
      <small>{sponsor.disclosure}</small>
    </aside>
  );
}
