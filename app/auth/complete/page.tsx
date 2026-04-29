"use client";

import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PENDING_DISPLAY_NAME_KEY = "shopping-list-display-name";

export default function AuthCompletePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState("מסיים התחברות...");

  useEffect(() => {
    async function completeAuth() {
      const displayName = localStorage
        .getItem(PENDING_DISPLAY_NAME_KEY)
        ?.trim();

      if (displayName) {
        const { error } = await supabase.auth.updateUser({
          data: { display_name: displayName },
        });

        if (!error) {
          localStorage.removeItem(PENDING_DISPLAY_NAME_KEY);
        }
      }

      setMessage("מעביר אותך לרשימות...");
      router.replace("/lists");
      router.refresh();
    }

    completeAuth();
  }, [router, supabase]);

  return (
    <main className="mobile-page flex items-center justify-center bg-white">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm shadow-slate-200/70">
        <p className="text-base font-semibold text-slate-900">{message}</p>
      </section>
    </main>
  );
}
