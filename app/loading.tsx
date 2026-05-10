import LoadingProgress from "@/components/LoadingProgress";

export default function Loading() {
  return (
    <main className="mobile-page bg-[#f4f5f8] text-slate-950">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-md items-center justify-center sm:max-w-lg">
        <LoadingProgress label="טוען..." detail="מכין את האפליקציה" />
      </div>
    </main>
  );
}
