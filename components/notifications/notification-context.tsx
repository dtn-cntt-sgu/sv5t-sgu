"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import styles from "./notifications.module.css";

const NotificationContext = createContext({
  unread: 0,
  revision: 0,
  error: false,
  loading: true,
  refresh: () => {},
});
export function NotificationProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({
    unread: 0,
    revision: 0,
    error: false,
    loading: true,
  });
  const [request, setRequest] = useState(0);
  const refresh = useCallback(() => setRequest((value) => value + 1), []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      const current = ++sequence;
      try {
        const data = await api<{ unread: number }>("/notifications/unread");
        if (active && current === sequence)
          setState((previous) => ({
            unread: data.unread,
            revision: previous.revision + 1,
            error: false,
            loading: false,
          }));
      } catch {
        if (active && current === sequence)
          setState((previous) => ({
            ...previous,
            error: true,
            loading: false,
          }));
      }
    }
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 150);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    const supabase = createClient();
    const channel = supabase
      .channel(`student-notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "student_notifications" },
        schedule,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "student_notification_reads",
          filter: `user_id=eq.${userId}`,
        },
        schedule,
      )
      .subscribe((status) => {
        if (active && status === "SUBSCRIBED") schedule();
      });
    schedule();
    const interval = setInterval(onVisible, 30000);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId, request]);
  return (
    <NotificationContext.Provider value={{ ...state, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}
export const useNotifications = () => useContext(NotificationContext);
export function NotificationBell() {
  const { unread, error, loading } = useNotifications();
  const label = unread
    ? `${unread} thông báo chưa đọc`
    : "Thông báo từ Hội Sinh viên";
  return (
    <Link
      href="/dashboard/notifications"
      className={`icon-button ${styles.bell}`}
      aria-label={label}
      title={
        error ? "Chưa cập nhật được thông báo. Nhấn để xem và thử lại." : label
      }
    >
      <Bell size={21} className={unread > 0 ? styles.ringing : undefined} />
      {unread > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {error && !unread && (
        <span className={styles.badge} aria-hidden="true">
          !
        </span>
      )}
      <span className="sr-only" role="status">
        {loading
          ? "Đang kiểm tra thông báo"
          : error
            ? "Chưa cập nhật được thông báo"
            : unread > 0
              ? label
              : "Không có thông báo chưa đọc"}
      </span>
    </Link>
  );
}
