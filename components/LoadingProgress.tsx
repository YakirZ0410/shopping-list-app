"use client";

import { ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";

type LoadingProgressProps = {
  label?: string;
  detail?: string;
  className?: string;
};

export default function LoadingProgress({
  label = "טוען...",
  detail = "מכין את הרשימה",
  className = "",
}: LoadingProgressProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProgress((currentProgress) => {
        if (currentProgress >= 92) {
          return currentProgress;
        }

        const step = currentProgress < 60 ? 7 : currentProgress < 82 ? 4 : 1;
        return Math.min(92, currentProgress + step);
      });
    }, 180);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center px-6 py-8 text-center ${className}`}>
      <div className="relative mb-5 grid h-20 w-20 place-items-center">
        <div className="absolute inset-0 rounded-[1.75rem] bg-blue-100" />
        <div
          className="absolute inset-0 rounded-[1.75rem] bg-[#3880ff]"
          style={{
            clipPath: `inset(${100 - progress}% 0 0 0 round 1.75rem)`,
          }}
          aria-hidden="true"
        />
        <div className="relative grid h-[4.25rem] w-[4.25rem] place-items-center rounded-[1.35rem] bg-white text-[#3880ff] shadow-sm shadow-blue-100">
          <ShoppingBasket size={32} strokeWidth={2.5} />
        </div>
      </div>

      <p className="text-base font-black text-slate-950">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>

      <div className="mt-5 w-full max-w-56" aria-label={`טעינה ${progress}%`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#3880ff] transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-black text-[#3880ff]">{progress}%</p>
      </div>
    </div>
  );
}
