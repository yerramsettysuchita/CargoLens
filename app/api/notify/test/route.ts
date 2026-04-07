import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendEmail, sendWhatsApp } from "@/app/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { channel, phone } = await req.json() as { channel: "email" | "whatsapp"; phone?: string };

    const testPayload = {
      type: "shipment_created" as const,
      shipmentId:    "test-000",
      shipmentCode:  "SHP-TEST-001",
      recipientEmail: user.email ?? "",
      recipientPhone: phone || user.user_metadata?.phone,
      data: {
        origin:             "India",
        destination:        "Netherlands",
        corridor:           "India to Netherlands",
        mode:               "sea",
        carrier:            "Maersk",
        estimatedDelayDays: 0,
        reason:             "This is a test notification from CargoLens.",
      },
    };

    let result;
    if (channel === "email") {
      result = await sendEmail(testPayload);
    } else if (channel === "whatsapp") {
      if (!testPayload.recipientPhone) {
        return NextResponse.json({ error: "No phone number saved. Add a WhatsApp number in Settings first." }, { status: 400 });
      }
      result = await sendWhatsApp(testPayload);
    } else {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Send failed", provider: result.provider }, { status: 500 });
    }

    return NextResponse.json({ ok: true, provider: result.provider });
  } catch (e) {
    console.error("[/api/notify/test]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
