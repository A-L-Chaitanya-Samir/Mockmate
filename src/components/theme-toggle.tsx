"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip label="Switch appearance">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Switch color theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun size={18} className="hidden dark:block" />
        <Moon size={18} className="dark:hidden" />
      </Button>
    </Tooltip>
  );
}
