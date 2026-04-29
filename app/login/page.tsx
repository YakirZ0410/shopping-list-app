"use client";

import { AppButton, AppPanel, AppScreen } from "@/components/AppUi";
import { createClient } from "@/lib/supabaseClient";
import { CheckCircle2, Mail, ShoppingBasket, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

const PENDING_DISPLAY_NAME_KEY = "shopping-list-display-name";
type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  function saveDisplayName() {
    const cleanName = displayName.trim();

    if (cleanName) {
      localStorage.setItem(PENDING_DISPLAY_NAME_KEY, cleanName);
    }

    return cleanName;
  }

  async function signInWithGoogle() {
    saveDisplayName();
    setMessage("");
    setIsGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setIsGoogleLoading(false);
    }
  }

  async function signInWithEmail() {
    const cleanName = authMode === "signup" ? saveDisplayName() : "";
    const cleanEmail = email.trim();

    setMessage("");
    setSentEmail("");

    if (authMode === "signup" && !cleanName) {
      setMessage("נא להזין שם כדי שנדע איך להציג אותך ברשימות");
      return;
    }

    if (!cleanEmail) {
      setMessage("נא להזין כתובת מייל");
      return;
    }

    setIsEmailLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: cleanName ? { display_name: cleanName } : undefined,
      },
    });

    setIsEmailLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSentEmail(cleanEmail);
  }

  return (
    <AppScreen className="justify-center">
      <div className="space-y-4">
        <div className="px-1 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-[#3880ff] shadow-sm shadow-blue-100">
            <ShoppingBasket size={31} strokeWidth={2.4} />
          </div>

          <p className="mb-2 text-sm font-black text-[#3880ff]">
            רשימת קניות משותפת
          </p>
          <h1 className="text-3xl font-black leading-tight text-slate-950">
            ברוך הבא
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
            התחבר כדי לנהל רשימות קניות משותפות, להזמין חברים ולעדכן מוצרים בזמן אמת.
          </p>
        </div>

        <AppPanel className="p-3">
          <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setMessage("");
                setSentEmail("");
              }}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                authMode === "signin"
                  ? "bg-white text-slate-950 shadow-sm shadow-slate-200"
                  : "text-slate-500"
              }`}
            >
              התחברות
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setMessage("");
                setSentEmail("");
              }}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                authMode === "signup"
                  ? "bg-white text-slate-950 shadow-sm shadow-slate-200"
                  : "text-slate-500"
              }`}
            >
              הרשמה
            </button>
          </div>

          <div className="px-1 pb-1">
            {authMode === "signup" && (
              <>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  שם להצגה
                </label>
                <div className="mb-4 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#3880ff] focus-within:ring-4 focus-within:ring-blue-100">
                  <UserRound size={18} className="shrink-0 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="nickname"
                    placeholder="לדוגמה: יקיר"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3 text-base text-slate-950 outline-none placeholder:text-slate-400"
                  />
                </div>
              </>
            )}

            <label className="mb-2 block text-sm font-bold text-slate-800">
              כתובת מייל
            </label>

            <div className="mb-4 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#3880ff] focus-within:ring-4 focus-within:ring-blue-100">
              <Mail size={18} className="shrink-0 text-slate-400" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSentEmail("");
                }}
                className="min-w-0 flex-1 bg-transparent py-3 text-base text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>

            <AppButton
              onClick={() => void signInWithEmail()}
              disabled={isEmailLoading || isGoogleLoading}
            >
              {isEmailLoading
                ? "שולח..."
                : authMode === "signup"
                  ? "שלח קישור הרשמה"
                  : "שלח קישור התחברות"}
            </AppButton>

            <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
              נשלח אליך קישור חד-פעמי. אין צורך בסיסמה.
            </p>

            {sentEmail && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-white text-emerald-600 shadow-sm shadow-emerald-100">
                  <CheckCircle2 size={22} strokeWidth={2.6} />
                </div>
                <p className="text-base font-black text-slate-950">
                  בדוק את המייל שלך
                </p>
                <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-600">
                  שלחנו קישור לכתובת {sentEmail}
                </p>
                <button
                  type="button"
                  onClick={() => void signInWithEmail()}
                  disabled={isEmailLoading}
                  className="mt-3 min-h-9 rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-700 shadow-sm shadow-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEmailLoading ? "שולח..." : "שלח שוב"}
                </button>
              </div>
            )}

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold text-slate-400">או</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <AppButton
              onClick={() => void signInWithGoogle()}
              variant="secondary"
              disabled={isEmailLoading || isGoogleLoading}
            >
              {isGoogleLoading ? "מעביר ל-Google..." : "המשך עם Google"}
            </AppButton>

            {message && (
              <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">
                {message}
              </p>
            )}
          </div>
        </AppPanel>
      </div>
    </AppScreen>
  );
}
