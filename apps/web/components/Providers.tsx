"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "../lib/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  // Prevent accidental number input changes when mouse wheel scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === "number") {
        active.blur();
      }
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        target.blur();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
