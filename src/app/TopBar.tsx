import { useState } from "react";
import { useAuth, ROLE_LABELS } from "@/core/auth";
import { ForexTicker } from "@/features/forex";
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
import { ChevronDown, Menu, LogOut, KeyRound } from "lucide-react";
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
  const [showChangePassword, setShowChangePassword] = useState(false);

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
        <ForexTicker />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-11 gap-2.5 px-2">
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
