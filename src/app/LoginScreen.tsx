import { useState } from "react";
import { useAuth } from "@/core/auth";
import { ApiError } from "@/core/api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Coffee } from "lucide-react";

/**
 * Full-page sign-in. The app renders nothing else until a live API session
 * exists (see AuthGate) — there is no demo mode to fall back to.
 */
export function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("The email/phone or password you entered is incorrect. Please try again.");
        } else if (err.status === 429) {
          setError("Too many sign-in attempts. Please wait a minute and try again.");
        } else {
          setError("Something went wrong on our end. Please try again shortly.");
        }
      } else {
        // Network error — server unreachable
        setError("Unable to connect. Please check that the server is running and try again.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">CE-OS</h1>
            <p className="text-sm text-muted-foreground">Coffee Export OS</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold">Sign in</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Enter your email or phone number and password to continue.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-identifier">Email or phone number</Label>
              <Input
                id="login-identifier"
                type="text"
                autoComplete="username"
                placeholder="email@example.com or +256700000000"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
