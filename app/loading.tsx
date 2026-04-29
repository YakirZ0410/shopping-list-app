import { ShoppingBasket } from "lucide-react";

export default function Loading() {
  return (
    <main className="mobile-page bg-[#f4f5f8] text-slate-950">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-md flex-col items-center justify-center gap-5 sm:max-w-lg">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-3xl bg-blue-100" />
          <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-white text-[#3880ff] shadow-sm shadow-blue-100">
            <ShoppingBasket size={31} strokeWidth={2.4} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-base font-black text-slate-950">טוען...</p>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#3880ff]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#3880ff] [animation-delay:120ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#3880ff] [animation-delay:240ms]" />
          </div>
        </div>
      </div>
    </main>
  );
}
