"use client";

import ConfirmDialog from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ListMembershipActionButtonProps = {
  listId: string;
  listName: string;
  role: "owner" | "member";
};

export default function ListMembershipActionButton({
  listId,
  listName,
  role,
}: ListMembershipActionButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isOwner = role === "owner";
  const actionLabel = isOwner ? "מחק רשימה" : "עזוב רשימה";
  const workingLabel = isOwner ? "מוחק..." : "עוזב...";
  const dialogTitle = isOwner ? "למחוק את הרשימה?" : "לעזוב את הרשימה?";
  const dialogDescription = isOwner
    ? `הפעולה תמחק את "${listName}" וכל המוצרים שבה. לא ניתן לבטל את המחיקה.`
    : `אחרי עזיבה, "${listName}" תיעלם מהרשימות שלך. אפשר להצטרף שוב רק עם קוד ואישור מנהל.`;
  const confirmLabel = isOwner ? "מחק רשימה" : "עזוב רשימה";

  async function runAction() {
    setIsConfirmOpen(false);
    setIsWorking(true);
    setMessage("");

    const { count, error } = isOwner
      ? await supabase
          .from("shopping_lists")
          .delete({ count: "exact" })
          .eq("id", listId)
      : await supabase
          .from("list_members")
          .delete({ count: "exact" })
          .eq("list_id", listId);

    setIsWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!count) {
      setMessage(
        isOwner
          ? "הרשימה לא נמחקה. ודא שאתה הבעלים והרצת את קובץ ה-SQL המעודכן."
          : "לא הצלחנו לעזוב את הרשימה. ודא שהרצת את קובץ ה-SQL המעודכן.",
      );
      return;
    }

    router.refresh();
  }

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isWorking}
        className="min-h-9 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isWorking ? workingLabel : actionLabel}
      </button>

      {message && (
        <p className="mt-2 max-w-52 rounded-xl bg-red-50 p-2 text-xs leading-5 text-red-700">
          {message}
        </p>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={confirmLabel}
        cancelLabel="ביטול"
        onConfirm={runAction}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
