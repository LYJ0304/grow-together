"use client";
import { useEffect, useState } from "react";
export function useDemoQuery<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<{
    source: (() => Promise<T>) | null;
    data: T | null;
    error: boolean;
  }>({ source: null, data: null, error: false });
  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setResult({ source: load, data, error: false });
      })
      .catch(() => {
        if (active) setResult({ source: load, data: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [load]);
  return {
    data: result.data,
    loading: result.source !== load,
    error: result.error,
  };
}
