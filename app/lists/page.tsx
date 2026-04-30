"use client";

import { AppButton, AppHeader, AppPanel, AppScreen } from "@/components/AppUi";
import CopyAccessCodeButton from "@/components/CopyAccessCodeButton";
import ListMembershipActionButton from "@/components/ListMembershipActionButton";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabaseClient";
import {
  CheckCircle2,
  ChevronLeft,
  Hash,
  ListPlus,
  Plus,
  Search,
  Share2,
  ShoppingCart,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ONBOARDING_STORAGE_KEY = "shopping-list-onboarding-seen";

const onboardingSteps: Array<{
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    title: "יוצרים רשימה",
    description: "פתח רשימת קניות חדשה לכל בית, אירוע או קניה משותפת.",
    Icon: ListPlus,
  },
  {
    title: "משתפים קוד הצטרפות",
    description: "כל רשימה מקבלת קוד. שולחים אותו למי שרוצה להצטרף.",
    Icon: Share2,
  },
  {
    title: "מאשרים חברים",
    description: "מנהל הרשימה מאשר בקשות הצטרפות לפני שחברים רואים את הרשימה.",
    Icon: UserCheck,
  },
  {
    title: "קונים ביחד בזמן אמת",
    description: "מוסיפים מוצרים, מעדכנים כמויות ומסמנים מה נקנה מכל מכשיר.",
    Icon: ShoppingCart,
  },
];

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
  created_at: string;
};

type ListWithRole = ListRow & {
  role: MembershipRow["role"];
  totalItems: number;
  pendingItems: number;
  boughtItems: number;
};

type UserSummary = {
  id: string;
  email?: string;
  displayName?: string;
};

type ItemSummaryRow = {
  list_id: string;
  is_bought: boolean;
};

export default function ListsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<UserSummary | null>(null);
  const [lists, setLists] = useState<ListWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const ownedCount = lists.filter((list) => list.role === "owner").length;
  const joinedCount = lists.filter((list) => list.role === "member").length;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("he-IL");
  const sortedLists = [...lists].sort((firstList, secondList) => {
    const firstPriority =
      firstList.pendingItems > 0 ? 0 : firstList.totalItems === 0 ? 1 : 2;
    const secondPriority =
      secondList.pendingItems > 0 ? 0 : secondList.totalItems === 0 ? 1 : 2;

    return firstPriority - secondPriority;
  });
  const filteredLists =
    normalizedSearchQuery.length === 0
      ? sortedLists
      : sortedLists.filter((list) => {
          const searchableText = `${list.name} ${list.access_code}`.toLocaleLowerCase(
            "he-IL",
          );

          return searchableText.includes(normalizedSearchQuery);
        });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true") {
        setShowOnboarding(true);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    }
  }, []);

  function closeOnboarding() {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setShowOnboarding(false);
  }

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadLists(showLoading = false) {
      if (showLoading) {
        setIsLoading(true);
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!isActive) {
        return null;
      }

      if (!authUser) {
        router.replace("/login");
        return null;
      }

      setErrorMessage("");

      const displayName =
        typeof authUser.user_metadata.display_name === "string"
          ? authUser.user_metadata.display_name
          : typeof authUser.user_metadata.full_name === "string"
            ? authUser.user_metadata.full_name
            : authUser.email;

      setUser({
        id: authUser.id,
        email: authUser.email,
        displayName,
      });

      const { data: memberships, error: membershipsError } = await supabase
        .from("list_members")
        .select("list_id, role, status, created_at")
        .eq("user_id", authUser.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!isActive) {
        return authUser.id;
      }

      if (membershipsError) {
        setErrorMessage(membershipsError.message);
        setIsLoading(false);
        return authUser.id;
      }

      if (!memberships || memberships.length === 0) {
        setLists([]);
        setIsLoading(false);
        return authUser.id;
      }

      const typedMemberships = memberships as MembershipRow[];
      const listIds = typedMemberships.map((membership) => membership.list_id);

      const { data: shoppingLists, error: shoppingListsError } = await supabase
        .from("shopping_lists")
        .select("id, name, access_code, owner_id, created_at")
        .in("id", listIds);

      if (!isActive) {
        return authUser.id;
      }

      if (shoppingListsError) {
        setErrorMessage(shoppingListsError.message);
        setIsLoading(false);
        return authUser.id;
      }

      const { data: itemSummaries, error: itemSummariesError } = await supabase
        .from("shopping_list_items")
        .select("list_id, is_bought")
        .in("list_id", listIds);

      if (!isActive) {
        return authUser.id;
      }

      if (itemSummariesError) {
        setErrorMessage(itemSummariesError.message);
        setIsLoading(false);
        return authUser.id;
      }

      const roleByListId = new Map(
        typedMemberships.map((membership) => [
          membership.list_id,
          membership.role,
        ]),
      );

      const listById = new Map(
        ((shoppingLists ?? []) as ListRow[]).map((list) => [list.id, list]),
      );

      const statsByListId = new Map(
        listIds.map((listId) => [
          listId,
          { totalItems: 0, pendingItems: 0, boughtItems: 0 },
        ]),
      );

      for (const item of (itemSummaries ?? []) as ItemSummaryRow[]) {
        const stats = statsByListId.get(item.list_id);

        if (!stats) {
          continue;
        }

        stats.totalItems += 1;

        if (item.is_bought) {
          stats.boughtItems += 1;
        } else {
          stats.pendingItems += 1;
        }
      }

      setLists(
        listIds
          .map((listId) => {
            const list = listById.get(listId);
            const role = roleByListId.get(listId);

            if (!list || !role) {
              return null;
            }

            const stats = statsByListId.get(listId) ?? {
              totalItems: 0,
              pendingItems: 0,
              boughtItems: 0,
            };

            return { ...list, role, ...stats };
          })
          .filter((list): list is ListWithRole => Boolean(list)),
      );
      setIsLoading(false);
      return authUser.id;
    }

    async function setupLists() {
      const authUserId = await loadLists(true);

      if (!isActive || !authUserId) {
        return;
      }

      channel = supabase
        .channel(`list-members-${authUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "list_members",
            filter: `user_id=eq.${authUserId}`,
          },
          () => {
            void loadLists();
          },
        )
        .subscribe();
    }

    function refreshOnFocus() {
      void loadLists();
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadLists();
      }
    }

    setupLists();
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
  }, [router, supabase]);

  return (
    <AppScreen>
      <AppHeader
        title="הרשימות שלי"
        subtitle={`שלום, ${user?.displayName ?? user?.email ?? ""}`}
        action={<LogoutButton />}
      />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm shadow-slate-200/80">
          {lists.length} רשימות
        </span>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-[#3880ff] shadow-sm shadow-blue-100/80">
          {ownedCount} בניהולך
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm shadow-slate-200/80">
          {joinedCount} משותפות
        </span>
        <button
          type="button"
          onClick={() => setShowOnboarding(true)}
          className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#3880ff] shadow-sm shadow-slate-200/80 transition hover:bg-blue-50"
        >
          איך זה עובד?
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <AppButton
          href="/lists/new"
          className="min-h-12 gap-2 px-3 py-2 text-sm"
        >
          <Plus size={18} strokeWidth={2.8} />
          <span className="whitespace-nowrap">רשימה חדשה</span>
        </AppButton>

        <AppButton
          href="/join"
          variant="secondary"
          className="min-h-12 gap-2 px-3 py-2 text-sm"
        >
          <Hash size={17} strokeWidth={2.8} />
          <span className="whitespace-nowrap">הצטרף עם קוד</span>
        </AppButton>
      </div>

      <AppPanel className="p-0">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-xl font-black text-slate-950">רשימות פעילות</h2>
          <p className="mt-1 text-sm text-slate-500">
            לחץ על רשימה כדי להיכנס אליה.
          </p>

          {lists.length > 0 && (
            <label className="mt-4 flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-[#f8fafc] px-3 text-sm shadow-inner shadow-slate-100">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="חפש רשימה או קוד הצטרפות"
                className="min-w-0 flex-1 bg-transparent font-bold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3 bg-[#f4f5f8] p-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-5 w-3/5 animate-pulse rounded-full bg-slate-200" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
                    <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-blue-50" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="h-8 w-36 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-8 w-20 animate-pulse rounded-full bg-red-50" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="m-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
            <p className="font-bold">הייתה שגיאה בטעינת הרשימות.</p>
            <p className="mt-1 break-words text-red-600">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && lists.length === 0 && (
          <div className="m-4 rounded-xl bg-slate-50 p-6 text-center">
            <p className="font-bold text-slate-900">עדיין אין לך רשימות.</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              צור רשימה חדשה או הצטרף לרשימה קיימת עם קוד.
            </p>
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          lists.length > 0 &&
          filteredLists.length === 0 && (
            <div className="m-4 rounded-xl bg-slate-50 p-6 text-center">
              <p className="font-bold text-slate-900">לא נמצאו רשימות.</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                נסה לחפש לפי שם הרשימה או לפי קוד ההצטרפות.
              </p>
            </div>
          )}

        <div className="space-y-3 bg-[#f4f5f8] p-3">
          {filteredLists.map((list) => {
            const boughtPercent =
              list.totalItems > 0
                ? Math.round((list.boughtItems / list.totalItems) * 100)
                : 0;

            return (
              <article
                key={list.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70"
              >
              <Link
                href={`/lists/${list.id}`}
                aria-label={`פתח את הרשימה ${list.name}`}
                className="flex items-center gap-3 p-4 transition hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                        list.role === "owner"
                          ? "bg-blue-50 text-[#3880ff]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {list.role === "owner" ? "מנהל" : "חבר"}
                    </span>

                    {list.totalItems > 0 && list.pendingItems === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        <CheckCircle2 size={13} strokeWidth={2.8} />
                        הכול נקנה
                      </span>
                    )}
                  </div>

                  <h3 className="truncate text-lg font-black leading-6 text-slate-950">
                    {list.name}
                  </h3>

                  <p className="mt-1 truncate text-sm font-bold text-slate-500">
                    {list.pendingItems} לקנייה · {list.boughtItems} נקנו ·{" "}
                    {list.totalItems} סה״כ
                  </p>

                  {list.totalItems > 0 && (
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                      aria-label={`${boughtPercent}% מהרשימה נקנה`}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${boughtPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                <ChevronLeft
                  size={22}
                  strokeWidth={2.8}
                  className="shrink-0 text-[#3880ff]"
                />
              </Link>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-[#f4f5f8] px-2.5 py-1.5">
                  <span className="shrink-0 text-xs font-bold text-slate-500">
                    קוד הצטרפות
                  </span>
                  <span className="truncate text-xs font-black tracking-[0.12em] text-slate-950">
                    {list.access_code}
                  </span>
                  <CopyAccessCodeButton code={list.access_code} compact />
                </div>

                <ListMembershipActionButton
                  listId={list.id}
                  listName={list.name}
                  role={list.role}
                />
              </div>
            </article>
            );
          })}
        </div>
      </AppPanel>

      {showOnboarding && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/35 px-3 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center">
          <button
            type="button"
            aria-label="סגור הדרכה"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeOnboarding}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/20"
          >
            <div className="flex justify-end px-4 pt-4">
              <button
                type="button"
                onClick={closeOnboarding}
                aria-label="סגור"
                title="סגור"
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
              >
                <X size={18} strokeWidth={2.6} />
              </button>
            </div>

            <div className="px-5 pb-5">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-[#3880ff]">
                <ShoppingCart size={26} strokeWidth={2.5} />
              </div>

              <div className="mt-4 text-center">
                <p className="text-sm font-black text-[#3880ff]">ברוך הבא</p>
                <h2
                  id="onboarding-title"
                  className="mt-1 text-2xl font-black text-slate-950"
                >
                  ככה עובדים עם הרשימות
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  כמה צעדים קצרים, ואז אפשר להתחיל לנהל קניות יחד.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {onboardingSteps.map(({ title, description, Icon }) => (
                  <div
                    key={title}
                    className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#3880ff] shadow-sm shadow-slate-200/70">
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-950">
                        {title}
                      </h3>
                      <p className="mt-0.5 text-sm leading-5 text-slate-500">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={closeOnboarding}
                className="mt-5 min-h-12 w-full rounded-xl bg-[#3880ff] px-5 py-3 text-base font-black text-white shadow-sm shadow-blue-200 transition hover:bg-[#3171e0] active:scale-[0.99]"
              >
                הבנתי, בוא נתחיל
              </button>
            </div>
          </section>
        </div>
      )}
    </AppScreen>
  );
}
