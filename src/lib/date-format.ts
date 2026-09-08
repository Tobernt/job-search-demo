const swedishDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Stockholm"
});

const swedishDateKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Stockholm"
});

const swedishTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm"
});

const leadingIsoDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const leadingTimePattern = /^\d{4}-\d{2}-\d{2}[T\s](\d{2}):(\d{2})/;
const explicitTimezonePattern = /(Z|[+-]\d{2}:?\d{2})$/i;

export function formatSwedishDate(value?: string, fallback = "Ej angivet") {
  const date = dateForDisplay(value);
  return date ? swedishDateFormatter.format(date) : fallback;
}

export function formatSwedishTime(value?: string, fallback = "--:--") {
  if (!value) return fallback;

  if (!hasExplicitTimezone(value)) {
    const time = leadingTimePattern.exec(value.trim());
    if (time) return `${time[1]}:${time[2]}`;
  }

  const date = instantForDisplay(value);
  return date ? swedishTimeFormatter.format(date) : fallback;
}

export function formatCheckedAt(value?: string) {
  if (!value) return "inte ännu";
  const dateKey = dateKeyForDisplay(value);
  const todayKey = swedishDateKeyFormatter.format(new Date());
  return dateKey === todayKey ? `idag ${formatSwedishTime(value)}` : `${formatSwedishDate(value)} ${formatSwedishTime(value)}`;
}

function dateKeyForDisplay(value: string) {
  const date = dateForDisplay(value);
  return date ? swedishDateKeyFormatter.format(date) : "";
}

function dateForDisplay(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (!hasExplicitTimezone(trimmed)) {
    const match = leadingIsoDatePattern.exec(trimmed);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    }
  }

  return instantForDisplay(trimmed);
}

function instantForDisplay(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function hasExplicitTimezone(value: string) {
  return explicitTimezonePattern.test(value.trim());
}
