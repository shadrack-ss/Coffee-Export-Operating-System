import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./nav";
import { useAuth } from "@/core/auth";
import { useData } from "@/core/store";
import { deriveAlerts } from "@/features/notifications";
import { cn } from "@/shared/lib/utils";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const data = useData();
  const { notifications } = data;
  const unread =
    notifications.filter((n) => !n.read).length +
    deriveAlerts(data, data.liveRate?.usd_ugx_rate ?? 0).length;

  const items = NAV_ITEMS.filter((i) => !i.perm || can(i.perm));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-brand-blue">
          <CoffeeMark />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">CE-OS</div>
          <div className="text-[11px] text-muted-foreground">
            Coffee Export OS
          </div>
        </div>
      </div>

      <nav id="tour-sidebar" className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            id={`tour-nav-${item.to.replace("/", "") || "dashboard"}`}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )
            }
          >
            <item.icon className="size-[18px] shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === "/notifications" && unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>


    </div>
  );
}

function CoffeeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v2M14 2v2M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    </svg>
  );
}
