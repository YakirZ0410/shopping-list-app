"use client";

import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="min-h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#3880ff] shadow-sm hover:bg-blue-50 active:scale-[0.99]"
    >
      התנתק
    </button>
  );
}
