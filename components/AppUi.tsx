import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type AppScreenProps = {
  children: ReactNode;
  className?: string;
};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backHref?: string;
  meta?: ReactNode;
  compact?: boolean;
};

type AppPanelProps = {
  children: ReactNode;
  className?: string;
};

type AppButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const buttonVariants = {
  primary:
    "bg-[#3880ff] text-white shadow-sm shadow-blue-200 hover:bg-[#3171e0]",
  secondary:
    "border border-slate-200 bg-white text-[#3880ff] shadow-sm hover:bg-slate-50",
  danger: "border border-red-100 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-[#3880ff] hover:bg-blue-50",
};

export function AppScreen({ children, className = "" }: AppScreenProps) {
  return (
    <main className="mobile-page bg-[#f4f5f8] text-slate-950">
      <div
        className={`mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-md flex-col gap-4 sm:max-w-lg ${className}`}
      >
        {children}
      </div>
    </main>
  );
}

export function AppHeader({
  title,
  subtitle,
  action,
  backHref,
  meta,
  compact = false,
}: AppHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-10 -mx-4 -mt-4 border-b border-slate-200/80 bg-white/95 px-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-sm shadow-slate-200/60 backdrop-blur ${
        compact ? "pb-2" : "pb-3"
      }`}
    >
      <div className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link
                href={backHref}
                aria-label="חזרה"
                title="חזרה"
                className={`grid shrink-0 place-items-center rounded-full text-[#3880ff] hover:bg-blue-50 active:scale-95 ${
                  compact ? "h-9 w-9" : "h-10 w-10"
                }`}
              >
                <ChevronRight size={compact ? 24 : 26} strokeWidth={2.5} />
              </Link>
            )}

            <div className="min-w-0">
              {subtitle && (
                <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">
                  {subtitle}
                </p>
              )}

              <h1
                className={`truncate font-black tracking-normal text-slate-950 ${
                  compact ? "text-xl" : "text-2xl"
                }`}
              >
                {title}
              </h1>
            </div>
          </div>

          {action}
        </div>

        {meta && <div className={compact ? "mt-1.5" : "mt-2"}>{meta}</div>}
      </div>
    </header>
  );
}

export function AppPanel({ children, className = "" }: AppPanelProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/80 ${className}`}
    >
      {children}
    </section>
  );
}

export function AppButton({
  children,
  className = "",
  href,
  type = "button",
  onClick,
  disabled,
  variant = "primary",
}: AppButtonProps) {
  const classes = `inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 py-3 text-center text-base font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
