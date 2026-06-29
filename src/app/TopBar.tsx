import { useState } from "react";
import { useAuth, ROLE_LABELS } from "@/core/auth";
import { ForexTicker } from "@/features/forex";
import { useTour, isTourPending } from "@/features/tour/TourProvider";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { Badge } from "@/shared/ui/badge";
import { ChevronDown, Menu, LogOut, KeyRound, MapPin } from "lucide-react";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, role, logout } = useAuth();
  const { startTour } = useTour();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [tourBadge] = useState(() => isTourPending());

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <ForexTicker id="tour-forex-ticker" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button id="tour-user-menu" variant="ghost" className="h-11 gap-2.5 px-2">
            <span className="flex size-8 items-center justify-center text-xs font-semibold text-primary">
              {initials(user.name)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">{user.name}</span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
            </span>
            <Badge variant="success" className="hidden sm:inline-flex">
              Live
            </Badge>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowChangePassword(true)}>
            <KeyRound className="size-4" /> Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={startTour}>
            <MapPin className="size-4" /> Take a tour
            {tourBadge && (
              <span className="ml-auto flex size-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={logout}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </header>
  );
}
