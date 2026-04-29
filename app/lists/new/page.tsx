"use client";

import { AppButton, AppHeader, AppPanel, AppScreen } from "@/components/AppUi";
import ConfirmDialog from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function NewListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [duplicateNameToConfirm, setDuplicateNameToConfirm] = useState("");

  async function createList(skipDuplicateCheck = false) {
    const listName = name.trim();

    setMessage("");

    if (!listName) {
      setMessage("נא להזין שם לרשימה");
      return;
    }

    if (!skipDuplicateCheck) {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: ownedLists, error: ownedListsError } = await supabase
        .from("shopping_lists")
        .select("name")
        .eq("owner_id", user.id);

      setIsLoading(false);

      if (ownedListsError) {
        setMessage(ownedListsError.message);
        return;
      }

      const normalizedListName = listName.toLocaleLowerCase("he-IL");
      const hasDuplicateName = (ownedLists ?? []).some(
        (list) =>
          typeof list.name === "string" &&
          list.name.trim().toLocaleLowerCase("he-IL") === normalizedListName,
      );

      if (hasDuplicateName) {
        setDuplicateNameToConfirm(listName);
        return;
      }
    }

    setDuplicateNameToConfirm("");
    setIsLoading(true);

    const { data, error } = await supabase.rpc("create_shopping_list", {
      list_name: listName,
    });

    setIsLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const createdListId = typeof data === "string" ? data : undefined;

    router.replace(createdListId ? `/lists/${createdListId}` : "/lists");
    router.refresh();
  }

  return (
    <AppScreen>
      <AppHeader title="רשימה חדשה" subtitle="התחלה מהירה" backHref="/lists" />

      <AppPanel>
        <p className="mb-5 text-base leading-7 text-slate-600">
          תן שם לרשימה, ואז תוכל להוסיף מוצרים ולסמן מה נקנה.
        </p>

        <label className="mb-2 block text-sm font-bold text-slate-800">
          שם הרשימה
        </label>

        <input
          type="text"
          autoComplete="off"
          placeholder="לדוגמה: קניות לבית"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-4 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />

        <AppButton onClick={() => void createList()} disabled={isLoading}>
          {isLoading ? "יוצר רשימה..." : "צור רשימה"}
        </AppButton>

        {message && (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm leading-6 text-red-700">
            {message}
          </p>
        )}
      </AppPanel>

      <ConfirmDialog
        open={Boolean(duplicateNameToConfirm)}
        title="כבר יש רשימה בשם הזה"
        description={`כבר יש לך רשימה בניהולך בשם "${duplicateNameToConfirm}". ליצור רשימה נוספת עם אותו שם?`}
        confirmLabel="צור בכל זאת"
        cancelLabel="ביטול"
        variant="warning"
        onConfirm={() => void createList(true)}
        onCancel={() => setDuplicateNameToConfirm("")}
      />
    </AppScreen>
  );
}
