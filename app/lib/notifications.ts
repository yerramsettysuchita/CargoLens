// ─── CargoLens Notification Service ───────────────────────────────────────────
// Email:    Resend  (free: 3,000/month) — set RESEND_API_KEY + RESEND_FROM
// WhatsApp: Twilio  (free sandbox)      — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
// All sends are stored in the notifications table via /api/notify.

export type NotificationType =
  | "shipment_created"
  | "customs_hold"
  | "high_delay_risk"
  | "delivered"
  | "at_risk"
  | "delay_update";

export type NotificationChannel = "email" | "whatsapp";

export interface NotificationPayload {
  type: NotificationType;
  shipmentId: string;
  shipmentCode: string;
  recipientEmail: string;
  recipientPhone?: string;
  data: Record<string, string | number>;
}

// ─── Email ─────────────────────────────────────────────────────────────────────

const EMAIL_SUBJECTS: Record<NotificationType, string> = {
  shipment_created: "Shipment Created on CargoLens",
  customs_hold:     "Customs Hold Alert on CargoLens",
  high_delay_risk:  "High Delay Risk Detected on CargoLens",
  delivered:        "Shipment Delivered",
  at_risk:          "Shipment At Risk on CargoLens",
  delay_update:     "Delay Update for Your Shipment",
};

const STATUS_COLOR: Record<NotificationType, string> = {
  shipment_created: "#1d4ed8",
  customs_hold:     "#d97706",
  high_delay_risk:  "#dc2626",
  delivered:        "#059669",
  at_risk:          "#ea580c",
  delay_update:     "#7c3aed",
};

const STATUS_EMOJI: Record<NotificationType, string> = {
  shipment_created: "✅",
  customs_hold:     "⚠️",
  high_delay_risk:  "🔴",
  delivered:        "📦",
  at_risk:          "🟠",
  delay_update:     "🕐",
};

function buildEmailHtml(payload: NotificationPayload): string {
  const { type, shipmentCode, data, shipmentId } = payload;
  const color   = STATUS_COLOR[type];
  const emoji   = STATUS_EMOJI[type];
  const subject = EMAIL_SUBJECTS[type];

  const bodyContent: Record<NotificationType, string> = {
    shipment_created: `
      <p style="margin:0 0 12px">Your shipment has been registered and is now tracked on CargoLens.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#6b7280">Route</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.origin ?? ""} → ${data.destination ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Mode</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.mode ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Carrier</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.carrier || "TBC"}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
      </table>
      <p style="margin:0;color:#6b7280;font-size:13px">Log in to CargoLens to track your shipment and manage documents.</p>
    `,
    customs_hold: `
      <p style="margin:0 0 8px">Shipment <strong>${shipmentCode}</strong> has been placed on <strong style="color:#d97706">Customs Hold</strong>. Immediate attention is needed.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Est. delay</td><td style="padding:6px 0;font-weight:600;color:#dc2626">+${data.estimatedDelayDays ?? "?"} days</td></tr>
        ${data.reason ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Reason</td><td style="padding:6px 0;color:#374151">${data.reason}</td></tr>` : ""}
      </table>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;font-size:13px;color:#92400e">
        <strong>Recommended action:</strong> Contact your customs broker immediately and review your compliance documents on CargoLens.
      </div>
    `,
    high_delay_risk: `
      <p style="margin:0 0 8px">CargoLens has detected a <strong style="color:#dc2626">high delay risk</strong> for shipment <strong>${shipmentCode}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Est. delay</td><td style="padding:6px 0;font-weight:600;color:#dc2626">+${data.estimatedDelayDays ?? "?"} days</td></tr>
        ${data.reason ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Risk reason</td><td style="padding:6px 0;color:#374151">${data.reason}</td></tr>` : ""}
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280">Please review your shipment and coordinate with your carrier to minimise the delay.</p>
    `,
    at_risk: `
      <p style="margin:0 0 8px">Shipment <strong>${shipmentCode}</strong> has been flagged as <strong style="color:#ea580c">At Risk</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
        ${data.reason ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Reason</td><td style="padding:6px 0;color:#374151">${data.reason}</td></tr>` : ""}
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280">Log in to review route alternatives and compliance status.</p>
    `,
    delay_update: `
      <p style="margin:0 0 8px">There is a delay update for shipment <strong>${shipmentCode}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Updated delay</td><td style="padding:6px 0;font-weight:600;color:#7c3aed">+${data.estimatedDelayDays ?? "?"} days</td></tr>
      </table>
    `,
    delivered: `
      <p style="margin:0 0 8px">Great news. Shipment <strong>${shipmentCode}</strong> has been marked as <strong style="color:#059669">Delivered</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0 16px">
        <tr><td style="padding:6px 0;color:#6b7280">Corridor</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.corridor ?? ""}</td></tr>
        ${data.carrier ? `<tr><td style="padding:6px 0;color:#6b7280">Carrier</td><td style="padding:6px 0;font-weight:600;color:#111827">${data.carrier}</td></tr>` : ""}
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280">Thank you for using CargoLens for your logistics visibility.</p>
    `,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px">

        <!-- Header -->
        <tr>
          <td style="background:${color};padding:20px 28px">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 10px;font-size:20px;line-height:1">${emoji}</td>
              <td style="padding-left:12px;color:#ffffff;font-size:16px;font-weight:700">${subject}</td>
            </tr></table>
          </td>
        </tr>

        <!-- Shipment badge -->
        <tr>
          <td style="padding:20px 28px 0">
            <span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;color:#1d4ed8;font-family:monospace">${shipmentCode}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:16px 28px 24px;color:#374151;font-size:14px;line-height:1.6">
          ${bodyContent[type]}
        </td></tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 28px 28px">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://cargolens.vercel.app"}/shipments/${shipmentId}"
               style="display:inline-block;background:${color};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:8px">
              View Shipment on CargoLens
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 28px">
            <p style="margin:0;font-size:11px;color:#9ca3af">
              CargoLens · Global Trade Control Tower ·
              You received this because you have an active shipment on this account.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── WhatsApp templates ────────────────────────────────────────────────────────

function buildWhatsAppMessage(payload: NotificationPayload): string {
  const { type, shipmentCode, data } = payload;
  const messages: Record<NotificationType, string> = {
    shipment_created: `✅ *CargoLens* — Shipment *${shipmentCode}* created.\nRoute: ${data.origin ?? ""} → ${data.destination ?? ""}\nMode: ${data.mode ?? ""} via ${data.carrier || "TBC"}\n\nTrack it on CargoLens.`,
    customs_hold:     `⚠️ *CargoLens Alert* — Shipment *${shipmentCode}* is on *Customs Hold*.\nCorridor: ${data.corridor ?? ""}\nEst. delay: +${data.estimatedDelayDays ?? "?"}d\n\nContact your customs broker immediately.`,
    high_delay_risk:  `🔴 *CargoLens* — High delay risk on *${shipmentCode}*.\n${data.reason ? `Reason: ${data.reason}\n` : ""}Est. delay: +${data.estimatedDelayDays ?? "?"}d\n\nLog in to review route alternatives.`,
    at_risk:          `🟠 *CargoLens* — Shipment *${shipmentCode}* is at risk.\nCorridor: ${data.corridor ?? ""}\n${data.reason ? `Reason: ${data.reason}\n` : ""}\nLog in to check and act.`,
    delay_update:     `🕐 *CargoLens* — Delay update for *${shipmentCode}*.\nUpdated delay: +${data.estimatedDelayDays ?? "?"}d on the ${data.corridor ?? ""} corridor.`,
    delivered:        `📦 *CargoLens* — Shipment *${shipmentCode}* has been delivered.\nCorridor: ${data.corridor ?? ""}. Thank you for using CargoLens.`,
  };
  return messages[type];
}

// ─── Providers ────────────────────────────────────────────────────────────────

export async function sendEmail(
  payload: NotificationPayload
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const subject = EMAIL_SUBJECTS[payload.type];
  const html    = buildEmailHtml(payload);
  const from    = process.env.RESEND_FROM ?? "CargoLens <onboarding@resend.dev>";

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to:      [payload.recipientEmail],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[CargoLens] Resend error:", err);
        return { ok: false, provider: "resend", error: err };
      }
      const json = await res.json();
      console.log("[CargoLens] Email sent via Resend:", json.id);
      return { ok: true, provider: "resend" };
    } catch (e) {
      console.error("[CargoLens] Email send failed:", e);
      return { ok: false, provider: "resend", error: String(e) };
    }
  }

  // No key — log stub
  console.log("[CargoLens Email STUB]", { to: payload.recipientEmail, subject });
  return { ok: true, provider: "stub" };
}

export async function sendWhatsApp(
  payload: NotificationPayload
): Promise<{ ok: boolean; provider?: string; error?: string }> {
  if (!payload.recipientPhone) return { ok: false, error: "No phone number provided" };

  const body = buildWhatsAppMessage(payload);

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const sid  = process.env.TWILIO_ACCOUNT_SID;
      const auth = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

      // Normalise number: ensure E.164 with whatsapp: prefix
      const to = payload.recipientPhone.startsWith("whatsapp:")
        ? payload.recipientPhone
        : `whatsapp:+${payload.recipientPhone.replace(/\D/g, "")}`;

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method:  "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:  `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
          },
          body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        console.error("[CargoLens] Twilio error:", err);
        return { ok: false, provider: "twilio", error: err };
      }
      const json = await res.json();
      console.log("[CargoLens] WhatsApp sent via Twilio:", json.sid);
      return { ok: true, provider: "twilio" };
    } catch (e) {
      console.error("[CargoLens] WhatsApp send failed:", e);
      return { ok: false, provider: "twilio", error: String(e) };
    }
  }

  // No keys — log stub
  console.log("[CargoLens WhatsApp STUB]", { to: payload.recipientPhone, body });
  return { ok: true, provider: "stub" };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatch(
  payload: NotificationPayload,
  channels: NotificationChannel[] = ["email"],
): Promise<{ email?: { ok: boolean; provider?: string }; whatsapp?: { ok: boolean; provider?: string } }> {
  const results: { email?: { ok: boolean; provider?: string }; whatsapp?: { ok: boolean; provider?: string } } = {};
  if (channels.includes("email"))    results.email    = await sendEmail(payload);
  if (channels.includes("whatsapp")) results.whatsapp = await sendWhatsApp(payload);
  return results;
}
