import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dispatch, type NotificationType, type NotificationPayload } from "@/app/lib/notifications";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shipmentId, type, channels = ["email"] } = body as {
      shipmentId: string;
      type: NotificationType;
      channels?: ("email" | "whatsapp")[];
    };

    if (!shipmentId || !type) {
      return NextResponse.json({ error: "shipmentId and type required" }, { status: 400 });
    }

    // Load shipment + user from Supabase
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

    const { data: shipment } = await supabase
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .single();

    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const s = shipment as Shipment;

    // Resolve phone: body override → user metadata → shipment field
    const phone: string | undefined =
      (body as { phone?: string }).phone ||
      (user.user_metadata?.phone as string | undefined) ||
      (s as unknown as { phone?: string }).phone ||
      undefined;

    const payload: NotificationPayload = {
      type,
      shipmentId: s.id,
      shipmentCode: s.shipment_code,
      recipientEmail: user.email ?? (s as unknown as { email?: string }).email ?? "",
      recipientPhone: phone,
      data: {
        origin:             s.origin_country,
        destination:        s.destination_country,
        corridor:           s.corridor,
        mode:               s.shipment_mode,
        carrier:            s.carrier ?? "",
        estimatedDelayDays: 0,
        reason:             s.compliance_notes ?? "",
      },
    };

    const result = await dispatch(payload, channels);

    // Store notification record
    await supabase.from("notifications").insert({
      shipment_id:  s.id,
      user_id:      user.id,
      type,
      channel:      channels.join(","),
      recipient:    payload.recipientEmail,
      status:       "sent",
    });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[/api/notify]", e);
    return NextResponse.json({ error: "Notification dispatch failed" }, { status: 500 });
  }
}
