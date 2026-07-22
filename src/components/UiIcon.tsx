import {
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  House,
  Lock,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

const icons = {
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  House,
  Lock,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UsersRound,
  X,
} satisfies Record<string, LucideIcon>;

export type UiIconName = keyof typeof icons;

interface UiIconProps {
  name: UiIconName;
  label?: string;
  size?: 16 | 20 | 24 | 40;
  className?: string;
}

export default function UiIcon({ name, label, size = 20, className }: UiIconProps) {
  const Icon = icons[name];
  return <Icon aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} size={size} strokeWidth={1.75} className={className} />;
}
