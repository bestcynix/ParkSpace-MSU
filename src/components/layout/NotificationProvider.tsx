"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type NotificationKind = "info" | "success" | "warning" | "error";

type NotificationInput = {
  title: string;
  message?: string;
  kind?: NotificationKind;
  duration?: number;
};

type NotificationItem = NotificationInput & { id: string };

type ConfirmInput = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
};

type ConfirmState = ConfirmInput & { resolve: (value: boolean) => void };

type NotificationContextValue = {
  notify: (input: NotificationInput) => void;
  confirm: (input: ConfirmInput) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const kindIcon = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const item: NotificationItem = { ...input, id, kind: input.kind ?? "info", duration: input.duration ?? 5500 };
    setNotifications((current) => [...current.slice(-3), item]);
    if ((item.duration ?? 0) > 0) {
      const timer = window.setTimeout(() => dismiss(id), item.duration);
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  const confirm = useCallback((input: ConfirmInput) => new Promise<boolean>((resolve) => {
    setConfirmState((current) => {
      current?.resolve(false);
      return { ...input, resolve };
    });
  }), []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState((current) => {
      if (current) current.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => () => {
    confirmState?.resolve(false);
  }, [confirmState]);

  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-stack" aria-live="polite" aria-atomic="true">
        {notifications.map((item) => {
          const Icon = kindIcon[item.kind ?? "info"];
          return <div className={`system-notification ${item.kind ?? "info"}`} key={item.id} role={item.kind === "error" ? "alert" : "status"}>
            <Icon size={18} />
            <div><strong>{item.title}</strong>{item.message ? <p>{item.message}</p> : null}</div>
            <button type="button" className="notification-close" onClick={() => dismiss(item.id)} aria-label="Close notification"><X size={15} /></button>
          </div>;
        })}
      </div>
      {confirmState ? <div className="confirm-overlay" role="presentation" onMouseDown={() => closeConfirm(false)}>
        <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="system-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="notification-close confirm-close" onClick={() => closeConfirm(false)} aria-label="Close"><X size={17} /></button>
          <div className="confirm-dialog-icon"><TriangleAlert size={22} /></div>
          <h2 id="system-confirm-title">{confirmState.title}</h2>
          <p>{confirmState.message}</p>
          <div className="confirm-actions"><button className="secondary-button" type="button" onClick={() => closeConfirm(false)}>{confirmState.cancelLabel}</button><button className={confirmState.danger ? "danger-action-button" : "primary-button"} type="button" onClick={() => closeConfirm(true)}>{confirmState.confirmLabel}</button></div>
        </div>
      </div> : null}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
