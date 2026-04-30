import { createClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORT_EMAIL = "hehr345@gmail.com";
const RESEND_API_URL = "https://api.resend.com/emails";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const supportFromEmail = process.env.SUPPORT_FROM_EMAIL;

  if (!resendApiKey || !supportFromEmail) {
    return NextResponse.json(
      { error: "שליחת פניות עדיין לא הוגדרה בשרת." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { error: "צריך להתחבר כדי לשלוח דיווח." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (message.length < 5) {
    return NextResponse.json(
      { error: "כדאי לכתוב כמה מילים כדי שנוכל להבין מה קרה." },
      { status: 400 },
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: "ההודעה ארוכה מדי. אפשר לקצר ולנסות שוב." },
      { status: 400 },
    );
  }

  const sentAt = new Date().toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");
  const safeUserEmail = escapeHtml(user.email);
  const safeUserId = escapeHtml(user.id);

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: supportFromEmail,
      to: SUPPORT_EMAIL,
      reply_to: user.email,
      subject: "דיווח על בעיה באפליקציית רשימת קניות",
      text: [
        "דיווח חדש מהאפליקציה",
        "",
        `משתמש: ${user.email}`,
        `מזהה משתמש: ${user.id}`,
        `נשלח בתאריך: ${sentAt}`,
        "",
        "תוכן ההודעה:",
        message,
      ].join("\n"),
      html: `
        <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#0f172a">
          <h1 style="margin:0 0 12px;font-size:22px">דיווח חדש מהאפליקציה</h1>
          <p style="margin:0 0 6px"><strong>משתמש:</strong> ${safeUserEmail}</p>
          <p style="margin:0 0 6px"><strong>מזהה משתמש:</strong> ${safeUserId}</p>
          <p style="margin:0 0 16px"><strong>נשלח בתאריך:</strong> ${sentAt}</p>
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#f8fafc">
            ${safeMessage}
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "לא הצלחנו לשלוח את הדיווח. נסה שוב עוד רגע." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
