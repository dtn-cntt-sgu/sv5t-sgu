"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    if (!path) {
      setState({ loading: false });
      return;
    }
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    try {
      const data = await api<T>(path);
      if (current === sequence.current) setState({ data, loading: false });
    } catch (error) {
      if (current === sequence.current)
        setState({
          error:
            error instanceof Error ? error.message : "Không thể tải dữ liệu.",
          loading: false,
        });
    }
  }, [path]);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => {
      clearTimeout(timer);
    };
  }, [reload]);
  return { ...state, reload };
}
