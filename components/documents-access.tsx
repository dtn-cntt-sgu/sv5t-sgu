"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { BookOpen, LockKeyhole, X } from "lucide-react";
import { api } from "@/lib/client/api";
import styles from "./documents-access.module.css";

const DocumentsAccessContext = createContext<{
  check: () => Promise<void>;
  pending: boolean;
} | null>(null);

export function DocumentsAccessProvider({
  enabled,
  initiallyBlocked = false,
  children,
}: {
  enabled: boolean;
  initiallyBlocked?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const checking = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<"registration" | "error" | null>(
    initiallyBlocked ? "registration" : null,
  );

  useEffect(() => {
    if (!notice) return;
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [notice]);

  async function check() {
    if (checking.current) return;
    checking.current = true;
    setPending(true);
    try {
      const status = await api<{ registered: boolean }>("/participation");
      if (status.registered === true) router.push("/documents");
      else setNotice("registration");
    } catch {
      setNotice("error");
    } finally {
      checking.current = false;
      setPending(false);
    }
  }

  return (
    <DocumentsAccessContext.Provider
      value={enabled ? { check, pending } : null}
    >
      {children}
      <span className="sr-only" role="status">
        {pending ? "Đang kiểm tra đăng ký tham gia…" : ""}
      </span>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="documents-access-title"
        aria-describedby="documents-access-description"
        onClose={() => setNotice(null)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialog.current?.close();
        }}
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Đóng thông báo"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
        <div className={styles.icon} aria-hidden="true">
          <BookOpen size={30} strokeWidth={1.7} />
          <span>
            <LockKeyhole size={13} />
          </span>
        </div>
        <span className={styles.eyebrow}>TÀI LIỆU & HƯỚNG DẪN</span>
        <h2 id="documents-access-title">
          {notice === "error"
            ? "Chưa thể kiểm tra đăng ký"
            : "Đăng ký để tiếp tục"}
        </h2>
        <p id="documents-access-description">
          {notice === "error"
            ? "Chưa kiểm tra được trạng thái đăng ký tham gia. Vui lòng thử lại sau."
            : 'Bạn hãy đăng ký tham gia xét duyệt danh hiệu "Sinh viên 5 tốt" để truy cập tính năng này'}
        </p>
        {notice !== "error" && (
          <p className={styles.hint}>
            Nhấn <b>“Đăng ký tham gia”</b> ở đầu trang để bắt đầu hành trình của bạn.
          </p>
        )}
        <button
          type="button"
          className={styles.confirm}
          onClick={() => dialog.current?.close()}
          autoFocus
        >
          Đã hiểu
        </button>
      </dialog>
    </DocumentsAccessContext.Provider>
  );
}

export function DocumentsLink({
  href = "/documents",
  onNavigate,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href?: string }) {
  const access = useContext(DocumentsAccessContext);
  const guarded = href === "/documents" && access !== null;
  return (
    <Link
      {...props}
      href={href}
      prefetch={guarded ? false : props.prefetch}
      aria-busy={guarded && access.pending ? true : undefined}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (!prevented && guarded) {
          event.preventDefault();
          void access.check();
        }
      }}
    />
  );
}
