"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "מחק",
  cancelLabel = "ביטול",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="סגור חלון אישור"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onCancel}
      />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/20"
      >
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            aria-label="סגור"
            title="סגור"
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            <X size={18} strokeWidth={2.6} />
          </button>
        </div>

        <div className="px-5 pb-5 text-center">
          <div
            className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${
              variant === "danger"
                ? "bg-red-50 text-red-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {variant === "danger" ? (
              <Trash2 size={24} strokeWidth={2.4} />
            ) : (
              <AlertTriangle size={24} strokeWidth={2.4} />
            )}
          </div>

          <h2
            id="confirm-dialog-title"
            className="mt-4 text-xl font-black text-slate-950"
          >
            {title}
          </h2>

          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm leading-6 text-slate-500"
          >
            {description}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
            >
              {cancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className={`min-h-12 rounded-xl px-4 py-3 text-base font-black text-white shadow-sm transition active:scale-[0.99] ${
                variant === "danger"
                  ? "bg-red-600 shadow-red-200 hover:bg-red-700"
                  : "bg-[#3880ff] shadow-blue-200 hover:bg-[#3171e0]"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
