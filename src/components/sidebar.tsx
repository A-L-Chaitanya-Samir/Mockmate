"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, LogOut, Sparkles, ArrowUpRight } from "lucide-react";
import { navigation } from "@/constants/navigation";
import { useDemoStore } from "@/stores/demo-store";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { useFeatureAccess } from "@/hooks/use-feature-access";
export function SidebarContent({
  collapsed = false,
  path,
  room,
  close,
  mobile = false,
}: {
  collapsed?: boolean;
  path: string;
  room: boolean;
  close: () => void;
  mobile?: boolean;
}) {
  const router = useRouter();
  const profile = useDemoStore((s) => s.profile);
  const logout = useDemoStore((s) => s.logout);
  const { definition } = useFeatureAccess();
  return (
    <>
      <div className="sidebar-brand">
        <Brand compact={collapsed} />
        {mobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={close}
          >
            <X size={18} />
          </Button>
        )}
      </div>
      <div className="workspace-label">
        <span className="workspace-avatar">M</span>
        <div>
          <strong>Personal workspace</strong>
          <small>
            {definition.name} · Demo <span className="status-dot" />
          </small>
        </div>
      </div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Application navigation">
        {navigation.map((item) => {
          const active =
            item.href === "/dashboard"
              ? path === item.href
              : path.startsWith(item.href) ||
                ((room || path === "/dashboard/analytics") &&
                  item.href === "/dashboard/interview");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={close}
              className={cn(
                "nav-link",
                active && "nav-link-active",
                item.href === "/dashboard/settings" && "nav-settings",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {active && <span className="nav-active-dot" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="practice-note">
          <Sparkles size={20} />
          <h3>Your next chapter starts here.</h3>
          <p>A little practice. A lot more confidence.</p>
          <Link href="/dashboard/interview/setup" onClick={close}>
            Start a session <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-profile">
          <Link
            href="/dashboard/settings"
            onClick={close}
            className="flex items-center gap-3 min-w-0"
          >
            <span className="avatar">
              {profile.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="profile-copy">
              <strong>{profile.name}</strong>
              <small>Personal account</small>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={() => {
              logout();
              close();
              router.push("/login");
            }}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
