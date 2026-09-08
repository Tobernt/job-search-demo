import { headers } from "next/headers";
import { notFound } from "next/navigation";

export interface AdminAccess {
  ok: boolean;
  actor: string;
  reason?: string;
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const headerStore = await headers();
  const accessEmail = headerStore.get("cf-access-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const accessJwt = headerStore.get("cf-access-jwt-assertion")?.trim() ?? "";
  const allowedEmails = parseAllowedEmails(process.env.ADMIN_ALLOWED_EMAILS);

  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_REQUIRE_CLOUDFLARE !== "true") {
    return { ok: true, actor: accessEmail || "local-dev" };
  }

  if (!accessEmail || !accessJwt) {
    return { ok: false, actor: "", reason: "Cloudflare Access headers are required." };
  }

  if (allowedEmails.length && !allowedEmails.includes(accessEmail)) {
    return { ok: false, actor: accessEmail, reason: "Authenticated user is not in ADMIN_ALLOWED_EMAILS." };
  }

  return { ok: true, actor: accessEmail };
}

export async function requireAdminAccess() {
  const access = await getAdminAccess();
  if (!access.ok) notFound();
  return access;
}

function parseAllowedEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}
