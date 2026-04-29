"use client";

import { AppButton, AppHeader, AppPanel, AppScreen } from "@/components/AppUi";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function JoinListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function joinList() {
    const cleanCode = accessCode.trim();

    setMessage("");
    setIsSuccess(false);

    if (!cleanCode) {
      setMessage("נא להזין קוד הצטרפות");
      return;
    }

    setIsLoading(true);

    const { data: listId, error } = await supabase.rpc("join_shopping_list", {
      list_access_code: cleanCode,
    });

    if (error) {
      setIsLoading(false);
      setMessage(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && typeof listId === "string") {
      const { data: membership } = await supabase
        .from("list_members")
        .select("status")
        .eq("user_id", user.id)
        .eq("list_id", listId)
        .maybeSingle();

      if (membership?.status === "approved") {
        setIsLoading(false);
        setMessage(
          "המשתמש אושר מיד. זה אומר שפונקציית Supabase עדיין בגרסה הישנה. הרץ את קובץ ה-SQL המעודכן.",
        );
        return;
      }
    }

    setIsLoading(false);
    setIsSuccess(true);
    setMessage("בקשת הצטרפות נשלחה למנהל הרשימה לאישור");
    setAccessCode("");

    window.setTimeout(() => {
      router.replace("/lists");
      router.refresh();
    }, 1600);
  }

  return (
    <AppScreen>
      <AppHeader title="הצטרפות לרשימה" subtitle="קיבלת קוד?" backHref="/lists" />

      <AppPanel>
        <p className="mb-5 text-base leading-7 text-slate-600">
          הזן את קוד ההצטרפות שקיבלת. לאחר השליחה מנהל הרשימה יצטרך לאשר אותך.
        </p>

        <label className="mb-2 block text-sm font-bold text-slate-800">
          קוד הצטרפות
        </label>

        <input
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC123"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
          className="mb-4 min-h-12 w-full rounded-xl border border-slate-200 bg-[#f4f5f8] px-4 py-3 text-center text-base font-black tracking-[0.25em] text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#3880ff] focus:ring-4 focus:ring-blue-100"
        />

        <AppButton onClick={joinList} disabled={isLoading || isSuccess}>
          {isLoading ? "שולח בקשה..." : "שלח בקשת הצטרפות"}
        </AppButton>

        {message && (
          <p
            className={`mt-4 rounded-xl p-3 text-sm leading-6 ${
              isSuccess
                ? "bg-blue-50 text-[#3880ff]"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        )}
      </AppPanel>
    </AppScreen>
  );
}
