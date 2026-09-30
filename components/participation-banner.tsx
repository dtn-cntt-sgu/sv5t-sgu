"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, UserRoundPlus, Users } from "lucide-react";
import { api } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/domain/models";
import styles from "./participation-banner.module.css";

type ParticipationStatus = { total: number; registered: boolean };

export function ParticipationBanner({ profile }: { profile?: Profile }) {
  const [status, setStatus] = useState<ParticipationStatus>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const sequence = useRef(0);
  const submitting = useRef(false);
  const canRegister = profile?.role === "STUDENT" && profile.is_active;

  const invalidateRequests = useCallback(() => {
    ++sequence.current;
  }, []);

  const refresh = useCallback(async () => {
    if (submitting.current) return;
    const request = ++sequence.current;
    try {
      const data = await api<ParticipationStatus>("/participation");
      if (request === sequence.current) {
        setStatus(data);
        setError("");
      }
    } catch {
      if (request === sequence.current)
        setError("Chưa cập nhật được lượt đăng ký. Vui lòng thử lại.");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout>;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 150);
    };
    const channel = supabase
      .channel("participation-total")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participation_totals" },
        scheduleRefresh,
      )
      .subscribe((state) => {
        if (!active) return;
        setConnected(state === "SUBSCRIBED");
        if (state === "SUBSCRIBED") scheduleRefresh();
      });
    scheduleRefresh();
    // Recover missed events during network interruptions or background tabs.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") scheduleRefresh();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      invalidateRequests();
      clearTimeout(refreshTimer);
      clearInterval(interval);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh, invalidateRequests, profile?.id]);

  async function register() {
    if (!canRegister || status?.registered || submitting.current) return;
    submitting.current = true;
    ++sequence.current;
    setPending(true);
    setError("");
    try {
      const data = await api<ParticipationStatus>("/participation", {
        method: "POST",
      });
      setStatus(data);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Chưa thể đăng ký. Vui lòng thử lại.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section
      className={styles.banner}
      aria-label="Đăng ký tham gia xét danh hiệu"
    >
      <div className={styles.content}>
        <div className={styles.counter}>
          <Users size={20} aria-hidden="true" />
          <div>
            <div className={styles.total} aria-live="polite" aria-atomic="true">
              <strong>
                {status ? status.total.toLocaleString("vi-VN") : "—"}
              </strong>
              <span>sinh viên đã đăng ký</span>
            </div>
            <small className={styles.caption}>
              <i
                className={connected && !error ? styles.live : styles.offline}
              />
              Tham gia xét danh hiệu Sinh viên 5 Tốt
            </small>
          </div>
        </div>
        {profile?.role === "STUDENT" && (
          <button
            type="button"
            className={styles.register}
            disabled={!canRegister || !status || status.registered || pending}
            onClick={() => void register()}
            title={
              !canRegister
                ? "Chỉ sinh viên đã đăng nhập mới được đăng ký tham gia"
                : undefined
            }
          >
            {pending ? (
              <LoaderCircle size={16} className="spin" />
            ) : status?.registered ? (
              <CheckCircle2 size={16} />
            ) : (
              <UserRoundPlus size={16} />
            )}
            {pending
              ? "Đang đăng ký…"
              : status?.registered
                ? "Đã đăng ký tham gia"
                : "Đăng ký tham gia"}
          </button>
        )}
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}{" "}
          <button type="button" onClick={() => void refresh()}>
            Tải lại
          </button>
        </div>
      )}
    </section>
  );
}
