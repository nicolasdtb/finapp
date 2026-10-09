import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

// Avisos (toast) e confirmacao dentro do app, no lugar de alert/confirm/prompt
// nativos do navegador. Os avisos nao bloqueiam a tela.

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

interface FeedbackContextValue {
  toast: ToastApi;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  error: 6000,
};

const TOAST_STYLE: Record<ToastKind, { border: string; icon: string }> = {
  success: { border: "border-emerald-500/40", icon: "text-emerald-400" },
  error: { border: "border-rose-500/40", icon: "text-rose-400" },
  info: { border: "border-blue-500/40", icon: "text-blue-400" },
};

const ToastIcon: React.FC<{ kind: ToastKind }> = ({ kind }) => {
  const className = `w-5 h-5 shrink-0 mt-0.5 ${TOAST_STYLE[kind].icon}`;
  if (kind === "success") return <CheckCircle2 className={className} />;
  if (kind === "error") return <AlertCircle className={className} />;
  return <Info className={className} />;
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION[kind])
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setConfirmState((previous) => {
        // Se ja havia uma confirmacao aberta, ela e cancelada.
        previous?.resolve(false);
        return { options: normalized, resolve };
      });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmState) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeConfirm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmState, closeConfirm]);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      toast: {
        success: (message) => push("success", message),
        error: (message) => push("error", message),
        info: (message) => push("info", message),
      },
      confirm,
    }),
    [push, confirm]
  );

  const opts = confirmState?.options;

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Avisos: ficam acima da barra de navegacao e nao bloqueiam cliques no resto da tela */}
      <div
        className="fixed left-0 right-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto w-full max-w-sm flex items-start gap-3 p-3.5 bg-slate-900 border ${TOAST_STYLE[t.kind].border} rounded-2xl shadow-xl shadow-black/40 text-sm text-slate-100`}
          >
            <ToastIcon kind={t.kind} />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="text-slate-500 hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmacao (usada so para exclusoes) */}
      {opts && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => closeConfirm(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={opts.title || "Confirmação"}
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl"
          >
            {opts.title && <h3 className="text-base font-bold text-slate-100 mb-1">{opts.title}</h3>}
            <p className="text-sm text-slate-300 leading-relaxed">{opts.message}</p>
            <div className="flex gap-2 mt-5">
              <button
                ref={cancelRef}
                onClick={() => closeConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
              >
                {opts.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition text-white ${
                  opts.danger === false
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {opts.confirmLabel || "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useToast/useConfirm precisam estar dentro de <FeedbackProvider>.");
  }
  return context;
}

export const useToast = (): ToastApi => useFeedback().toast;
export const useConfirm = () => useFeedback().confirm;
