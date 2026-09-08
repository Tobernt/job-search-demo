"use client";

import { useState } from "react";

export function ReportForm({ jobId }: { jobId: string }) {
  const [reportType, setReportType] = useState("expired");
  const [reportText, setReportText] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, reportType, reportText, website })
    });
    setStatus(response.ok ? "sent" : "failed");
    if (response.ok) setReportText("");
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <label>
        <span>Typ</span>
        <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
          <option value="expired">Gammal annons</option>
          <option value="duplicate">Dublett</option>
          <option value="wrong_role">Fel yrke eller kategori</option>
          <option value="wrong_work_mode">Fel arbetsform</option>
          <option value="broken_apply_link">Trasig ansökningslänk</option>
          <option value="suspicious">Misstänkt annons</option>
        </select>
      </label>
      <label>
        <span>Kommentar</span>
        <textarea value={reportText} onChange={(event) => setReportText(event.target.value)} rows={4} />
      </label>
      <label className="report-honeypot" aria-hidden="true">
        <span>Webbplats</span>
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Skickar..." : "Skicka rapport"}
      </button>
      {status === "sent" ? <p>Tack. Vi granskar rapporten.</p> : null}
      {status === "failed" ? <p>Kunde inte skicka rapporten.</p> : null}
    </form>
  );
}
