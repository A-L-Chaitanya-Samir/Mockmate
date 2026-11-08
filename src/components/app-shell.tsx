"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Menu,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { navigation } from "@/constants/navigation";
import { useDemoStore } from "@/stores/demo-store";
import { Button } from "./ui/button";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { DemoNotice } from "./ui/primitives";
import { cn } from "@/lib/utils";
export function AppShell({
  children,
  room = false,
}: {
  children: ReactNode;
  room?: boolean;
}) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const profile = useDemoStore((s) => s.profile);
  const current =
    navigation.find((n) => n.href !== "/dashboard" && path.startsWith(n.href))
      ?.label ??
    (room
      ? "Interview room"
      : path === "/dashboard/analytics"
        ? "Interview performance"
        : "Dashboard");
  const close = () => setMobile(false);
  return (
    <div
      className={cn(
        "app-shell",
        collapsed && "sidebar-collapsed",
        room && "room-shell",
      )}
    >
      <aside className="sidebar desktop-sidebar">
        <SidebarContent
          collapsed={collapsed}
          path={path}
          room={room}
          close={close}
        />
      </aside>
      <DialogPrimitive.Root open={mobile} onOpenChange={setMobile}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="mobile-backdrop" />
          <DialogPrimitive.Content className="sidebar sidebar-open mobile-drawer">
            <DialogPrimitive.Title className="sr-only">
              Workspace navigation
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Navigate your Mockmate demo workspace.
            </DialogPrimitive.Description>
            <SidebarContent path={path} room={room} close={close} mobile />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
        <div className="app-main">
          <header className="app-header">
            <div className="flex items-center gap-3">
              <DialogPrimitive.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mobile-only"
                  aria-label="Open navigation"
                >
                  <Menu size={20} />
                </Button>
              </DialogPrimitive.Trigger>
              <Button
                variant="ghost"
                size="icon"
                className="desktop-only"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
              </Button>
              <span className="breadcrumb">
                Workspace <ChevronRight size={13} />
                <strong>{current}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="header-demo">
                <span className="status-dot" />
                Demo workspace
              </span>
              <ThemeToggle />
              <Link
                href="/dashboard/settings"
                className="avatar avatar-small"
                aria-label="Profile settings"
              >
                {profile.name[0]}
              </Link>
            </div>
          </header>
          <main
            id="main-content"
            className={cn("app-content", room && "room-content")}
          >
            {children}
          </main>
          <footer className="app-footer">
            <DemoNotice compact />
            <span>Built for your next opportunity.</span>
          </footer>
        </div>
      </DialogPrimitive.Root>
    </div>
  );
}
