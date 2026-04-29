"use client";

import { createClient } from "@/lib/supabaseClient";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type JoinRequest = {
  membership_id: string;
  user_id: string;
  user_email: string;
  created_at: string;
};

type JoinRequestsPanelProps = {
  listId: string;
  isOwner: boolean;
};

export default function JoinRequestsPanel({
  listId,
  isOwner,
}: JoinRequestsPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadRequests() {
      if (!isOwner) {
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase.rpc("get_pending_join_requests", {
        target_list_id: listId,
      });

      if (!isActive) {
        return;
      }

      setIsLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setRequests((data ?? []) as JoinRequest[]);
    }

    loadRequests();

    return () => {
      isActive = false;
    };
  }, [isOwner, listId, supabase]);

  async function handleRequest(
    membershipId: string,
    action: "approve" | "reject",
  ) {
    setMessage("");
    setWorkingId(membershipId);

    const { error } = await supabase.rpc(
      action === "approve" ? "approve_join_request" : "reject_join_request",
      { target_membership_id: membershipId },
    );

    setWorkingId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.filter((request) => request.membership_id !== membershipId),
    );
  }

  if (!isOwner || (!isLoading && requests.length === 0 && !message)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/80">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-lg font-black text-slate-950">בקשות הצטרפות</h2>
        <p className="mt-1 text-sm text-slate-500">
          אשר או דחה משתמשים שרוצים להצטרף לרשימה.
        </p>
      </div>

      {isLoading && (
        <p className="p-4 text-sm text-slate-500">טוען בקשות...</p>
      )}

      {message && (
        <p className="m-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
          {message}
        </p>
      )}

      {requests.map((request) => (
        <div
          key={request.membership_id}
          className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-950">
              {request.user_email}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              מבקש להצטרף לרשימה
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => handleRequest(request.membership_id, "approve")}
              disabled={workingId === request.membership_id}
              aria-label={`אשר את ${request.user_email}`}
              title="אשר"
              className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#3880ff] hover:bg-blue-100 disabled:opacity-60"
            >
              <Check size={20} strokeWidth={2.8} />
            </button>

            <button
              type="button"
              onClick={() => handleRequest(request.membership_id, "reject")}
              disabled={workingId === request.membership_id}
              aria-label={`דחה את ${request.user_email}`}
              title="דחה"
              className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              <X size={20} strokeWidth={2.8} />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
