import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ToastKind = "info" | "ok" | "error";
interface ToastItem { id: number; kind: ToastKind; text: string }
interface ToastApi { push: (text: string, kind?: ToastKind) => void }

const Ctx = createContext<ToastApi>({ push: () => {} });

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, kind: ToastKind = "info") => {
    const id = ++_id;
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto card px-4 py-2.5 text-sm shadow-2xl backdrop-blur-md border-l-4 ${
              t.kind === "error" ? "border-l-pink-500" : t.kind === "ok" ? "border-l-emerald-400" : "border-l-violet-400"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }

// Небольшой хелпер чтобы из компонент-обработчиков можно было кидать ошибку API в тост
export function useApiError() {
  const { push } = useToast();
  return useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      push(msg, "error");
    },
    [push],
  );
}
