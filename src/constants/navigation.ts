import {
  LayoutDashboard,
  FileText,
  MessagesSquare,
  Lightbulb,
  Settings,
} from "lucide-react";
export const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/resume", label: "Resume Analysis", icon: FileText },
  {
    href: "/dashboard/interview",
    label: "AI Interviews",
    icon: MessagesSquare,
  },
  {
    href: "/dashboard/suggestions",
    label: "Suggestions & Advice",
    icon: Lightbulb,
  },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
