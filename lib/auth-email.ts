import { EnvConfigError } from "@/lib/env";

type AuthEmailKind = "verify" | "reset";

export async function sendAuthEmail(input: { kind: AuthEmailKind; to: string; name: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new EnvConfigError("Authentication email delivery is not configured", ["RESEND_API_KEY", "AUTH_EMAIL_FROM"]);
    }
    return { delivered: false, previewUrl: input.url };
  }

  const action = input.kind === "verify" ? "Verify your email" : "Reset your password";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `${action} - FantasyX`,
      text: `${action}: ${input.url}\n\nThis link expires soon. If you did not request it, you can ignore this message.`,
      html: emailHtml(action, input.name, input.url)
    })
  });
  if (!response.ok) throw new Error(`Email provider rejected the request (${response.status})`);
  return { delivered: true, previewUrl: null };
}

function emailHtml(action: string, name: string, url: string) {
  return `<div style="font-family:Arial,sans-serif;background:#0D1117;color:#E2E8F0;padding:32px"><div style="max-width:560px;margin:auto"><div style="font-weight:800;color:#00D46A;font-size:22px">FantasyX</div><h1 style="font-size:24px">${escapeHtml(action)}</h1><p>Hi ${escapeHtml(name || "there")},</p><p>Use the secure button below to continue.</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#00D46A;color:#0D1117;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:6px">${escapeHtml(action)}</a></p><p style="color:#94A3B8;font-size:13px">This link expires soon and can only be used once.</p></div></div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]!));
}
