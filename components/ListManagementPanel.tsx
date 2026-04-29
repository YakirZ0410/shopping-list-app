"use client";

import ConfirmDialog from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabaseClient";
import { Bell, Check, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type JoinRequest = {
  membership_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  created_at: string;
};

type ListMember = {
  membership_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: "owner" | "member";
  status: "approved" | "pending" | "rejected";
  created_at: string;
};

type ListManagementPanelProps = {
  listId: string;
  isOwner: boolean;
};

type ActivePanel = "requests" | "members" | null;

function getDisplayName(person: { user_name?: string | null; user_email: string }) {
  return person.user_name?.trim() || person.user_email;
}

function shouldShowEmail(person: { user_name?: string | null; user_email: string }) {
  return getDisplayName(person) !== person.user_email;
}

export default function ListManagementPanel({
  listId,
  isOwner,
}: ListManagementPanelProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [message, setMessage] = useState("");
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ListMember | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadRequests() {
      if (!isOwner) {
        return;
      }

      setIsLoadingRequests(true);

      const { data, error } = await supabase.rpc("get_pending_join_requests", {
        target_list_id: listId,
      });

      if (!isActive) {
        return;
      }

      setIsLoadingRequests(false);

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

  useEffect(() => {
    let isActive = true;

    async function loadMembers() {
      setIsLoadingMembers(true);

      const { data, error } = await supabase.rpc("get_list_members", {
        target_list_id: listId,
      });

      if (!isActive) {
        return;
      }

      setIsLoadingMembers(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMembers((data ?? []) as ListMember[]);
    }

    loadMembers();

    return () => {
      isActive = false;
    };
  }, [listId, supabase]);

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

    const handledRequest = requests.find(
      (request) => request.membership_id === membershipId,
    );

    setRequests((currentRequests) =>
      currentRequests.filter((request) => request.membership_id !== membershipId),
    );

    if (action === "approve" && handledRequest) {
      setMembers((currentMembers) => [
        ...currentMembers,
        {
          membership_id: handledRequest.membership_id,
          user_id: handledRequest.user_id,
          user_email: handledRequest.user_email,
          user_name: handledRequest.user_name,
          role: "member",
          status: "approved",
          created_at: handledRequest.created_at,
        },
      ]);
    }
  }

  async function removeMember() {
    if (!memberToRemove) {
      return;
    }

    setMessage("");
    setWorkingId(memberToRemove.membership_id);
    setMemberToRemove(null);

    const { error } = await supabase.rpc("remove_list_member", {
      target_membership_id: memberToRemove.membership_id,
    });

    setWorkingId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.filter(
        (currentMember) =>
          currentMember.membership_id !== memberToRemove.membership_id,
      ),
    );
  }

  function openPanel(panel: Exclude<ActivePanel, null>) {
    setMessage("");
    setActivePanel(panel);
  }

  function closePanel() {
    setActivePanel(null);
  }

  const sheetTitle = activePanel === "requests" ? "בקשות הצטרפות" : "חברי הרשימה";

  const sheet =
    activePanel && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/35 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-[2px]">
            <button
              type="button"
              aria-label="סגור חלון"
              className="absolute inset-0 h-full w-full cursor-default"
              onClick={closePanel}
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-label={sheetTitle}
              className="relative z-10 flex max-h-[82svh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/20"
            >
              <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-200" />

              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-slate-950">
                    {sheetTitle}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {activePanel === "requests"
                      ? "אישור או דחייה של משתמשים חדשים"
                      : "כל מי שמחובר לרשימה הזו"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="סגור"
                  title="סגור"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
                >
                  <X size={20} strokeWidth={2.6} />
                </button>
              </div>

              {message && (
                <p className="mx-4 mt-4 shrink-0 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
                  {message}
                </p>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                {activePanel === "requests" && isOwner && (
                  <>
                    {isLoadingRequests && (
                      <p className="p-4 text-sm text-slate-500">
                        טוען בקשות...
                      </p>
                    )}

                    {!isLoadingRequests && requests.length === 0 && (
                      <p className="p-4 text-sm text-slate-500">
                        אין בקשות שממתינות לאישור.
                      </p>
                    )}

                    {requests.map((request) => (
                      <div
                        key={request.membership_id}
                        className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-950">
                            {getDisplayName(request)}
                          </p>
                          {shouldShowEmail(request) && (
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                              {request.user_email}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            מבקש להצטרף לרשימה
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleRequest(request.membership_id, "approve")
                            }
                            disabled={workingId === request.membership_id}
                            aria-label={`אשר את ${getDisplayName(request)}`}
                            title="אשר"
                            className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#3880ff] hover:bg-blue-100 disabled:opacity-60"
                          >
                            <Check size={20} strokeWidth={2.8} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleRequest(request.membership_id, "reject")
                            }
                            disabled={workingId === request.membership_id}
                            aria-label={`דחה את ${getDisplayName(request)}`}
                            title="דחה"
                            className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                          >
                            <X size={20} strokeWidth={2.8} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {activePanel === "members" && (
                  <>
                    {isLoadingMembers && (
                      <p className="p-4 text-sm text-slate-500">
                        טוען חברים...
                      </p>
                    )}

                    {!isLoadingMembers && members.length === 0 && (
                      <p className="p-4 text-sm text-slate-500">
                        עדיין אין חברים ברשימה.
                      </p>
                    )}

                    {members.map((member) => (
                      <div
                        key={member.membership_id}
                        className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-slate-950">
                            {getDisplayName(member)}
                          </p>
                          {shouldShowEmail(member) && (
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                              {member.user_email}
                            </p>
                          )}
                          <div className="mt-2">
                            {member.role === "owner" ? (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#3880ff]">
                                מנהל
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                חבר
                              </span>
                            )}
                          </div>
                        </div>

                        {isOwner && member.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(member)}
                            disabled={workingId === member.membership_id}
                            aria-label={`הוצא את ${getDisplayName(member)}`}
                            title="הוצא מהקבוצה"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        {isOwner && (
          <button
            type="button"
            onClick={() => openPanel("requests")}
            aria-label="בקשות הצטרפות"
            title="בקשות הצטרפות"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#3880ff] transition hover:bg-blue-100 active:scale-95"
          >
            <Bell size={20} strokeWidth={2.5} />
            {requests.length > 0 && (
              <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
                {requests.length}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => openPanel("members")}
          aria-label="חברי הרשימה"
          title="חברי הרשימה"
          className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-[#3880ff] transition hover:bg-blue-100 active:scale-95"
        >
          <Users size={21} strokeWidth={2.5} />
        </button>
      </div>

      {sheet}

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="להוציא חבר מהרשימה?"
        description={
          memberToRemove
            ? `${getDisplayName(memberToRemove)} כבר לא יוכל לראות או לערוך את הרשימה אחרי ההסרה.`
            : ""
        }
        confirmLabel="הוצא חבר"
        cancelLabel="ביטול"
        onConfirm={removeMember}
        onCancel={() => setMemberToRemove(null)}
      />
    </>
  );
}
