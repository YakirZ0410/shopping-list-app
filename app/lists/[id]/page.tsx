"use client";

import { AppHeader, AppPanel, AppScreen } from "@/components/AppUi";
import CopyAccessCodeButton from "@/components/CopyAccessCodeButton";
import ListItemsClient from "@/components/ListItemsClient";
import ListManagementPanel from "@/components/ListManagementPanel";
import LoadingProgress from "@/components/LoadingProgress";
import { createClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ListRow = {
  id: string;
  name: string;
  access_code: string;
  owner_id: string;
  created_at: string;
};

type MembershipRow = {
  list_id: string;
  role: "owner" | "member";
  status: "approved" | "pending" | "rejected";
};

function AccessCodeMeta({ code }: { code: string }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 rounded-xl bg-[#f4f5f8] px-2.5 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs font-bold text-slate-500">
          קוד הצטרפות:
        </span>
        <span className="truncate text-sm font-black tracking-[0.14em] text-slate-950">
          {code}
        </span>
      </div>

      <CopyAccessCodeButton code={code} compact />
    </div>
  );
}

export default function ListDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [list, setList] = useState<ListRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const listId = params.id;

  useLayoutEffect(() => {
    const headerElement = headerRef.current;

    if (!headerElement) {
      return;
    }

    const measuredHeaderElement = headerElement;

    function updateHeaderHeight() {
      setHeaderHeight(measuredHeaderElement.getBoundingClientRect().height);
    }

    updateHeaderHeight();

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(measuredHeaderElement);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadList(showLoading = false) {
      if (showLoading) {
        setIsLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) {
        return null;
      }

      if (!user) {
        router.replace("/login");
        return null;
      }

      setMessage("");

      const { data: membershipData, error: membershipError } = await supabase
        .from("list_members")
        .select("list_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .eq("list_id", listId)
        .maybeSingle();

      if (!isActive) {
        return user.id;
      }

      if (membershipError) {
        setMessage(membershipError.message);
        setIsLoading(false);
        return user.id;
      }

      if (!membershipData) {
        setMessage("אין לך הרשאה לפתוח את הרשימה הזאת.");
        setMembership(null);
        setList(null);
        setIsLoading(false);
        return user.id;
      }

      const { data: listData, error: listError } = await supabase
        .from("shopping_lists")
        .select("id, name, access_code, owner_id, created_at")
        .eq("id", listId)
        .maybeSingle();

      if (!isActive) {
        return user.id;
      }

      if (listError) {
        setMessage(listError.message);
        setIsLoading(false);
        return user.id;
      }

      if (!listData) {
        setMessage("הרשימה לא נמצאה.");
        setMembership(null);
        setList(null);
        setIsLoading(false);
        return user.id;
      }

      setMembership(membershipData as MembershipRow);
      setList(listData as ListRow);
      setIsLoading(false);
      return user.id;
    }

    async function setupList() {
      const authUserId = await loadList(true);

      if (!isActive || !authUserId) {
        return;
      }

      channel = supabase
        .channel(`list-members-${authUserId}-${listId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "list_members",
            filter: `user_id=eq.${authUserId}`,
          },
          () => {
            void loadList();
          },
        )
        .subscribe();
    }

    function refreshOnFocus() {
      void loadList();
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadList();
      }
    }

    setupList();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isActive = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }

      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [listId, router, supabase]);

  if (isLoading) {
    return (
      <AppScreen>
        <AppHeader title="טוען רשימה..." backHref="/lists" compact />
        <AppPanel className="p-0">
          <LoadingProgress
            label="פותח רשימה..."
            detail="טוען פרטים ומכין מוצרים"
          />
        </AppPanel>
      </AppScreen>
    );
  }

  if (message || !list || !membership) {
    return (
      <AppScreen>
        <AppHeader title="לא ניתן לפתוח רשימה" backHref="/lists" />
        <AppPanel>
          <p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
            {message || "הייתה שגיאה בטעינת הרשימה."}
          </p>
        </AppPanel>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <div ref={headerRef}>
        <AppHeader
          title={list.name}
          backHref="/lists"
          compact
          action={
            <ListManagementPanel
              listId={list.id}
              isOwner={membership.role === "owner"}
            />
          }
          meta={<AccessCodeMeta code={list.access_code} />}
        />
      </div>

      <ListItemsClient listId={list.id} stickyTop={headerHeight} />
    </AppScreen>
  );
}
