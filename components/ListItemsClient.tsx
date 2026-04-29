"use client";

import { AppPanel } from "@/components/AppUi";
import ConfirmDialog from "@/components/ConfirmDialog";
import { createClient } from "@/lib/supabaseClient";
import {
  BrushCleaning,
  Check,
  Minus,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ShoppingListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  is_bought: boolean;
  created_by: string | null;
  created_by_name: string | null;
  is_created_by_current_user: boolean;
  created_at: string;
};

type ListMember = {
  user_id: string;
  user_name: string;
  user_email: string;
};

type ListItemsClientProps = {
  listId: string;
  stickyTop?: number;
};

type PendingConfirmation =
  | { type: "deleteItem"; item: ShoppingListItem }
  | { type: "clearBought"; count: number }
  | { type: "clearAll"; count: number };

function parseItemNames(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanQuantity(value: number) {
  return Math.max(1, Math.floor(value || 1));
}

function normalizeItemName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function changeQuantityBy(currentValue: number, delta: number) {
  return cleanQuantity(currentValue + delta);
}

function isMissingShoppingListItemsRpcError(message: string) {
  return (
    message.includes("get_shopping_list_items") &&
    message.includes("schema cache")
  );
}

function getUserDisplayName(
  user:
    | {
        email?: string;
        user_metadata?: {
          display_name?: string;
          full_name?: string;
          name?: string;
        };
      }
    | null
    | undefined,
) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    null
  );
}

export default function ListItemsClient({
  listId,
  stickyTop = 0,
}: ListItemsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [updatingQuantityItemId, setUpdatingQuantityItemId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [clearingMode, setClearingMode] = useState<"all" | "bought" | null>(
    null,
  );
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [recentlyDeletedItem, setRecentlyDeletedItem] =
    useState<ShoppingListItem | null>(null);

  const pendingItems = items.filter((item) => !item.is_bought);
  const boughtItems = items.filter((item) => item.is_bought);
  const searchTerm = normalizeItemName(newItemText);
  const isSearching = searchTerm.length > 0;
  const exactExistingItem = isSearching
    ? items.find((item) => normalizeItemName(item.name) === searchTerm)
    : undefined;
  const visiblePendingItems = isSearching
    ? pendingItems.filter((item) =>
        normalizeItemName(item.name).includes(searchTerm),
      )
    : pendingItems;
  const visibleBoughtItems = isSearching
    ? boughtItems.filter((item) =>
        normalizeItemName(item.name).includes(searchTerm),
      )
    : boughtItems;
  const visibleItemsCount = visiblePendingItems.length + visibleBoughtItems.length;

  const loadItems = useCallback(
    async () => {
      const { data, error } = await supabase.rpc("get_shopping_list_items", {
        target_list_id: listId,
      });

      if (!error) {
        setIsLoading(false);
        setItems((data ?? []) as ShoppingListItem[]);
        return;
      }

      if (!isMissingShoppingListItemsRpcError(error.message)) {
        setIsLoading(false);
        setMessage(error.message);
        return;
      }

      const { data: memberData } = await supabase.rpc("get_list_members", {
        target_list_id: listId,
      });
      const memberNameById = new Map(
        ((memberData ?? []) as ListMember[]).map((member) => [
          member.user_id,
          member.user_name || member.user_email,
        ]),
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("shopping_list_items")
        .select("id, list_id, name, quantity, is_bought, created_by, created_at")
        .eq("list_id", listId)
        .order("created_at", { ascending: true });

      setIsLoading(false);

      if (fallbackError) {
        setMessage(fallbackError.message);
        return;
      }

      setItems(
        (fallbackData ?? []).map((item) => ({
          ...item,
          created_by_name: item.created_by
            ? memberNameById.get(item.created_by) ?? null
            : null,
          is_created_by_current_user: Boolean(
            user && item.created_by === user.id,
          ),
        })) as ShoppingListItem[],
      );
    },
    [listId, supabase],
  );

  const refreshItemsSoon = useCallback(() => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      void loadItems();
    }, 250);
  }, [loadItems]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadItems]);

  useEffect(() => {
    const channel = supabase
      .channel(`shopping-list-items-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shopping_list_items",
          filter: `list_id=eq.${listId}`,
        },
        refreshItemsSoon,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "shopping_list_items",
          filter: `list_id=eq.${listId}`,
        },
        refreshItemsSoon,
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "shopping_list_items",
        },
        refreshItemsSoon,
      )
      .subscribe();

    const fallbackRefreshIntervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadItems();
      }
    }, 5000);

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      window.clearInterval(fallbackRefreshIntervalId);
      void supabase.removeChannel(channel);
    };
  }, [listId, loadItems, refreshItemsSoon, supabase]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  useEffect(() => {
    if (!recentlyDeletedItem) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyDeletedItem(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyDeletedItem]);

  async function addItems() {
    const itemNames = parseItemNames(newItemText);
    const itemQuantity = cleanQuantity(quantity);

    setMessage("");

    if (itemNames.length === 0) {
      setMessage("נא להזין שם מוצר");
      return;
    }

    const existingNames = new Set(
      items.map((item) => normalizeItemName(item.name)),
    );
    const newNames = new Set<string>();

    for (const itemName of itemNames) {
      const normalizedName = normalizeItemName(itemName);

      if (existingNames.has(normalizedName) || newNames.has(normalizedName)) {
        setMessage(`המוצר "${itemName}" כבר קיים ברשימה`);
        inputRef.current?.focus();
        return;
      }

      newNames.add(normalizedName);
    }

    setIsAdding(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsAdding(false);
      setMessage(userError?.message || "צריך להתחבר מחדש כדי להוסיף מוצר");
      return;
    }

    const creatorName = getUserDisplayName(user);

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert(
        itemNames.map((name) => ({
          list_id: listId,
          name,
          quantity: itemQuantity,
          created_by: user.id,
        })),
      )
      .select("id, list_id, name, quantity, is_bought, created_by, created_at");

    setIsAdding(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      ...(data ?? []).map((item) => ({
        ...item,
        created_by_name: creatorName,
        is_created_by_current_user: true,
      })) as ShoppingListItem[],
    ]);
    setNewItemText("");
    setQuantity(1);
    inputRef.current?.focus();
  }

  async function toggleItem(item: ShoppingListItem) {
    const nextValue = !item.is_bought;

    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, is_bought: nextValue }
          : currentItem,
      ),
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ is_bought: nextValue })
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? item : currentItem,
        ),
      );
    }
  }

  async function updateItemQuantity(item: ShoppingListItem, nextQuantity: number) {
    const cleanedQuantity = cleanQuantity(nextQuantity);

    if (cleanedQuantity === item.quantity) {
      return;
    }

    const previousItems = items;

    setMessage("");
    setUpdatingQuantityItemId(item.id);
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, quantity: cleanedQuantity }
          : currentItem,
      ),
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ quantity: cleanedQuantity })
      .eq("id", item.id);

    setUpdatingQuantityItemId(null);

    if (error) {
      setMessage(error.message);
      setItems(previousItems);
    }
  }

  function startEditing(item: ShoppingListItem) {
    setMessage("");
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity);
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditName("");
    setEditQuantity(1);
  }

  async function saveItem(item: ShoppingListItem) {
    const nextName = editName.trim();
    const nextQuantity = cleanQuantity(editQuantity);
    const previousItems = items;

    setMessage("");

    if (!nextName) {
      setMessage("נא להזין שם מוצר");
      return;
    }

    setSavingItemId(item.id);
    setItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, name: nextName, quantity: nextQuantity }
          : currentItem,
      ),
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .update({ name: nextName, quantity: nextQuantity })
      .eq("id", item.id);

    setSavingItemId(null);

    if (error) {
      setMessage(error.message);
      setItems(previousItems);
      return;
    }

    cancelEditing();
  }

  async function deleteItem(item: ShoppingListItem) {
    const previousItems = items;

    setMessage("");
    setRecentlyDeletedItem(null);
    setItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== item.id),
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMessage(error.message);
      setItems(previousItems);
      return;
    }

    setRecentlyDeletedItem(item);
  }

  function requestDeleteItem(item: ShoppingListItem) {
    void deleteItem(item);
  }

  async function undoDeleteItem() {
    const itemToRestore = recentlyDeletedItem;

    if (!itemToRestore) {
      return;
    }

    setMessage("");
    setRecentlyDeletedItem(null);
    setItems((currentItems) => {
      if (currentItems.some((item) => item.id === itemToRestore.id)) {
        return currentItems;
      }

      return [...currentItems, itemToRestore].sort(
        (firstItem, secondItem) =>
          new Date(firstItem.created_at).getTime() -
          new Date(secondItem.created_at).getTime(),
      );
    });

    const { error } = await supabase.from("shopping_list_items").insert({
      id: itemToRestore.id,
      list_id: itemToRestore.list_id,
      name: itemToRestore.name,
      quantity: itemToRestore.quantity,
      is_bought: itemToRestore.is_bought,
      created_by: itemToRestore.created_by,
      created_at: itemToRestore.created_at,
    });

    if (error) {
      setMessage(error.message);
      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemToRestore.id),
      );
    }
  }

  function requestClearBoughtItems() {
    if (boughtItems.length === 0) {
      return;
    }

    setPendingConfirmation({ type: "clearBought", count: boughtItems.length });
  }

  function requestClearBoughtItemsFromMenu() {
    setIsActionsMenuOpen(false);
    requestClearBoughtItems();
  }

  async function clearBoughtItems() {
    const previousItems = items;

    setMessage("");
    setClearingMode("bought");
    setItems((currentItems) =>
      currentItems.filter((currentItem) => !currentItem.is_bought),
    );

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("list_id", listId)
      .eq("is_bought", true);

    setClearingMode(null);

    if (error) {
      setMessage(error.message);
      setItems(previousItems);
    }
  }

  function requestClearAllItems() {
    if (items.length === 0) {
      return;
    }

    setPendingConfirmation({ type: "clearAll", count: items.length });
  }

  function requestClearAllItemsFromMenu() {
    setIsActionsMenuOpen(false);
    requestClearAllItems();
  }

  async function clearAllItems() {
    const previousItems = items;

    setMessage("");
    setClearingMode("all");
    setItems([]);

    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("list_id", listId);

    setClearingMode(null);

    if (error) {
      setMessage(error.message);
      setItems(previousItems);
    }
  }

  function closeConfirmation() {
    setPendingConfirmation(null);
  }

  async function confirmPendingAction() {
    const action = pendingConfirmation;

    if (!action) {
      return;
    }

    setPendingConfirmation(null);

    if (action.type === "deleteItem") {
      await deleteItem(action.item);
      return;
    }

    if (action.type === "clearBought") {
      await clearBoughtItems();
      return;
    }

    await clearAllItems();
  }

  const confirmationContent = pendingConfirmation
    ? pendingConfirmation.type === "deleteItem"
      ? {
          title: "למחוק מוצר?",
          description: `הפעולה תמחק את "${pendingConfirmation.item.name}" מהרשימה.`,
          confirmLabel: "מחק מוצר",
        }
      : pendingConfirmation.type === "clearBought"
        ? {
            title: "לנקות מוצרים שנקנו?",
            description: `הפעולה תמחק ${pendingConfirmation.count} מוצרים שסומנו כנקנו מהרשימה.`,
            confirmLabel: "נקה נקנו",
          }
        : {
            title: "לנקות את כל הרשימה?",
            description: `כל ${pendingConfirmation.count} המוצרים יימחקו מהרשימה. לא ניתן לבטל את הפעולה.`,
            confirmLabel: "נקה הכל",
          }
    : null;

  function renderItem(item: ShoppingListItem) {
    const isEditing = editingItemId === item.id;
    const isSaving = savingItemId === item.id;
    const isQuantityUpdating = updatingQuantityItemId === item.id;
    const isExactSearchMatch = exactExistingItem?.id === item.id;
    const creatorLabel = item.is_created_by_current_user
      ? "הוסיף: אתה"
      : item.created_by_name
        ? `הוסיף: ${item.created_by_name}`
        : null;

    if (isEditing) {
      return (
        <div key={item.id} className="rounded-xl bg-white px-4 py-3">
          <div className="grid gap-2">
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-[#f4f5f8] px-4 py-2 text-base font-bold text-slate-950 outline-none focus:border-[#3880ff] focus:ring-4 focus:ring-blue-100"
              aria-label="שם מוצר"
            />

            <div className="grid grid-cols-[6rem_1fr_1fr] gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={editQuantity}
                onChange={(event) => setEditQuantity(Number(event.target.value))}
                className="min-h-11 rounded-xl border border-slate-200 bg-[#f4f5f8] px-3 py-2 text-center text-base font-black text-slate-950 outline-none focus:border-[#3880ff] focus:ring-4 focus:ring-blue-100"
                aria-label="כמות"
              />

              <button
                type="button"
                onClick={() => saveItem(item)}
                disabled={isSaving}
                className="min-h-11 rounded-xl bg-[#3880ff] px-3 py-2 text-sm font-black text-white hover:bg-[#3171e0] disabled:opacity-60"
              >
                {isSaving ? "שומר..." : "שמור"}
              </button>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`flex min-h-16 items-center gap-3 border-b px-1 py-3 transition last:border-b-0 ${
          isExactSearchMatch
            ? "border-blue-100 bg-blue-50/80"
            : "border-slate-100 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleItem(item)}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
            item.is_bought
              ? "border-[#3880ff] bg-[#3880ff] text-white"
              : "border-slate-300 bg-white text-transparent"
          }`}
          aria-label={item.is_bought ? "סמן כלא נקנה" : "סמן כנקנה"}
          title={item.is_bought ? "סמן כלא נקנה" : "סמן כנקנה"}
        >
          <Check size={18} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={() => toggleItem(item)}
          className={`min-w-0 flex-1 text-right ${
            item.is_bought ? "text-slate-400 line-through" : "text-slate-950"
          }`}
        >
          <span className="block truncate text-base font-bold">{item.name}</span>
          {creatorLabel && (
            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 no-underline">
              {creatorLabel}
            </span>
          )}
          <span className="sr-only">
            כמות: {item.quantity}
          </span>
        </button>

        <div
          className={`grid h-9 w-[5.5rem] shrink-0 grid-cols-[1.6rem_1fr_1.6rem] items-center rounded-full border ${
            item.is_bought
              ? "border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-200 bg-[#f4f5f8] text-slate-800"
          }`}
          aria-label={`כמות ${item.quantity}`}
        >
          <button
            type="button"
            onClick={() => updateItemQuantity(item, item.quantity - 1)}
            disabled={item.quantity <= 1 || isQuantityUpdating}
            aria-label={`הפחת כמות של ${item.name}`}
            title="הפחת כמות"
            className="grid h-8 place-items-center rounded-s-full transition hover:bg-slate-200 disabled:text-slate-300"
          >
            <Minus size={14} strokeWidth={2.8} />
          </button>

          <span className="text-center text-sm font-black">{item.quantity}</span>

          <button
            type="button"
            onClick={() => updateItemQuantity(item, item.quantity + 1)}
            disabled={isQuantityUpdating}
            aria-label={`הוסף כמות של ${item.name}`}
            title="הוסף כמות"
            className="grid h-8 place-items-center rounded-e-full text-[#3880ff] transition hover:bg-blue-50 disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2.8} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => startEditing(item)}
            aria-label={`ערוך את ${item.name}`}
            title="ערוך"
            className="grid h-10 w-10 place-items-center rounded-full text-[#3880ff] hover:bg-blue-50"
          >
            <Pencil size={18} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => requestDeleteItem(item)}
            aria-label={`מחק את ${item.name}`}
            title="מחק"
            className="grid h-10 w-10 place-items-center rounded-full text-red-600 hover:bg-red-50"
          >
            <X size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppPanel className="p-0">
      <div
        className="sticky z-10 overflow-visible border-b border-slate-100 bg-white/95 shadow-sm shadow-slate-200/60 backdrop-blur"
        style={{ top: stickyTop }}
      >
      <div className="p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_6.75rem_3rem] items-center gap-2">
          <div className="relative min-w-0">
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              placeholder="הוסף מוצר לרשימה"
              value={newItemText}
              onChange={(event) => setNewItemText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addItems();
                }
              }}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-[#f4f5f8] px-4 py-2.5 ps-11 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#3880ff] focus:ring-4 focus:ring-blue-100"
              aria-label="שם מוצר"
            />

            {isSearching && (
              <button
                type="button"
                onClick={() => {
                  setNewItemText("");
                  inputRef.current?.focus();
                }}
                aria-label="נקה חיפוש"
                title="נקה חיפוש"
                className="absolute inset-y-0 start-1 my-auto grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <span className="sr-only" id="item-quantity-label">
            כמות
          </span>
          <div
            className="grid min-h-11 grid-cols-[1.9rem_1fr_1.9rem] items-center rounded-xl border border-slate-200 bg-[#f4f5f8]"
            aria-labelledby="item-quantity-label"
          >
            <button
              type="button"
              onClick={() => setQuantity((current) => changeQuantityBy(current, -1))}
              disabled={quantity <= 1}
              aria-label="הפחת כמות"
              title="הפחת כמות"
              className="grid h-10 place-items-center rounded-s-xl text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
            >
              <Minus size={15} strokeWidth={2.8} />
            </button>

            <span className="text-center text-sm font-black text-slate-950">
              {quantity}
            </span>

            <button
              type="button"
              onClick={() => setQuantity((current) => changeQuantityBy(current, 1))}
              aria-label="הוסף כמות"
              title="הוסף כמות"
              className="grid h-10 place-items-center rounded-e-xl text-[#3880ff] transition hover:bg-blue-50"
            >
              <Plus size={15} strokeWidth={2.8} />
            </button>
          </div>

          <button
            type="button"
            onClick={addItems}
            disabled={isAdding}
            aria-label={isAdding ? "מוסיף מוצר" : "הוסף מוצר"}
            title={isAdding ? "מוסיף..." : "הוסף מוצר"}
            className="grid h-11 w-11 place-items-center rounded-xl bg-[#3880ff] text-white shadow-sm shadow-blue-200 transition hover:bg-[#3171e0] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>

        {isSearching && (
          <p
            className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              exactExistingItem
                ? "bg-blue-50 text-[#3880ff]"
                : visibleItemsCount > 0
                  ? "bg-slate-100 text-slate-600"
                  : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {exactExistingItem
              ? `המוצר "${exactExistingItem.name}" כבר קיים ברשימה`
              : visibleItemsCount > 0
                ? `נמצאו ${visibleItemsCount} מוצרים תואמים`
                : "לא נמצא מוצר קיים בשם הזה. אפשר להוסיף אותו."}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-center">
          <div className="rounded-full bg-slate-100 px-2 py-1.5">
            <span className="text-xs font-bold text-slate-500">סה״כ</span>
            <span className="ms-1 text-sm font-black text-slate-950">
              {items.length}
            </span>
          </div>

          <div className="rounded-full bg-blue-50 px-2 py-1.5">
            <span className="text-xs font-bold text-[#3880ff]">לקנייה</span>
            <span className="ms-1 text-sm font-black text-[#3880ff]">
              {pendingItems.length}
            </span>
          </div>

          <div className="rounded-full bg-slate-100 px-2 py-1.5">
            <span className="text-xs font-bold text-slate-500">נקנו</span>
            <span className="ms-1 text-sm font-black text-slate-950">
              {boughtItems.length}
            </span>
          </div>
          </div>

          {items.length > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsActionsMenuOpen((isOpen) => !isOpen)}
                disabled={clearingMode !== null}
                aria-expanded={isActionsMenuOpen}
                aria-label="פעולות ניקוי"
                title="פעולות ניקוי"
                className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-[#3880ff] transition hover:bg-blue-100 disabled:opacity-60"
              >
                <BrushCleaning size={18} strokeWidth={2.6} />
              </button>

              {isActionsMenuOpen && (
                <div className="absolute end-0 top-11 z-30 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-right shadow-xl shadow-slate-900/10">
                  <button
                    type="button"
                    onClick={requestClearBoughtItemsFromMenu}
                    disabled={boughtItems.length === 0 || clearingMode !== null}
                    className="block w-full px-4 py-3 text-right text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-300"
                  >
                    נקה נקנו
                  </button>

                  <button
                    type="button"
                    onClick={requestClearAllItemsFromMenu}
                    disabled={clearingMode !== null}
                    className="block w-full px-4 py-3 text-right text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:text-red-300"
                  >
                    נקה הכל
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      </div>

      {message && (
        <p className="m-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
          {message}
        </p>
      )}

      {isLoading && (
        <div className="space-y-4 p-4">
          <div>
            <div className="mb-3 h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex min-h-16 items-center gap-3 px-1 py-3"
                >
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="h-9 w-[5.5rem] shrink-0 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <p className="m-4 rounded-xl bg-slate-50 p-4 text-center text-sm leading-6 text-slate-500">
          עדיין אין מוצרים ברשימה. הוסף את המוצר הראשון.
        </p>
      )}

      {!isLoading && items.length > 0 && isSearching && visibleItemsCount === 0 && (
        <p className="m-4 rounded-xl bg-slate-50 p-4 text-center text-sm leading-6 text-slate-500">
          לא נמצאו מוצרים קיימים שמתאימים לחיפוש.
        </p>
      )}

      {visiblePendingItems.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-slate-500">
            מוצרים לקנייה
          </h3>
          <div>{visiblePendingItems.map(renderItem)}</div>
        </div>
      )}

      {visibleBoughtItems.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
              מוצרים שנקנו
            </h3>

          </div>
          <div>{visibleBoughtItems.map(renderItem)}</div>
        </div>
      )}
      </AppPanel>

      {recentlyDeletedItem && (
        <div className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-md">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/20">
            <span className="min-w-0 truncate">
              המוצר {recentlyDeletedItem.name} נמחק
            </span>

            <button
              type="button"
              onClick={undoDeleteItem}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-white transition hover:bg-white/20"
            >
              בטל
            </button>
          </div>
        </div>
      )}

      {confirmationContent && (
        <ConfirmDialog
          open={Boolean(pendingConfirmation)}
          title={confirmationContent.title}
          description={confirmationContent.description}
          confirmLabel={confirmationContent.confirmLabel}
          onConfirm={confirmPendingAction}
          onCancel={closeConfirmation}
        />
      )}
    </>
  );
}
