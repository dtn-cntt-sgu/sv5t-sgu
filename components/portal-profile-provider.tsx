"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, ApiError } from "@/lib/client/api";
import { useResource } from "@/lib/client/use-resource";
import type { Profile } from "@/lib/domain/models";

type ProfileResource = {
  data?: Profile;
  error?: string;
  loading: boolean;
  reload: () => Promise<void>;
};

const PortalProfileContext = createContext<ProfileResource | null>(null);

export function PortalProfileProvider({
  initialProfile,
  children,
}: {
  initialProfile: Profile;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<Omit<ProfileResource, "reload">>({
    data: initialProfile,
    loading: false,
  });
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    try {
      const data = await api<Profile>("/users/me");
      if (current === sequence.current) setState({ data, loading: false });
    } catch (error) {
      if (current !== sequence.current) return;
      const lostAccess =
        error instanceof ApiError && [401, 403].includes(error.status);
      setState((previous) => ({
        data: lostAccess ? undefined : previous.data,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải thông tin tài khoản.",
      }));
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 150);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("online", schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      invalidate();
      clearTimeout(timer);
      window.removeEventListener("online", schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, invalidate]);

  return (
    <PortalProfileContext.Provider value={{ ...state, reload }}>
      {children}
    </PortalProfileContext.Provider>
  );
}

export function usePortalProfile(): ProfileResource {
  const sharedProfile = useContext(PortalProfileContext);
  // Portals without a shared layout keep their existing profile loading behavior.
  const fallback = useResource<Profile>(sharedProfile ? null : "/users/me");
  return sharedProfile ?? fallback;
}
