"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useEffect, type ReactNode } from "react";
import { useDemoStore } from "@/stores/demo-store";
import * as Tooltip from "@radix-ui/react-tooltip";
import { DEMO_MODE } from "@/lib/mode";
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (DEMO_MODE) void useDemoStore.persist.rehydrate();
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Tooltip.Provider delayDuration={300}>
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}
