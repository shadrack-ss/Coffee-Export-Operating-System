import { useAuth } from "@/core/auth";
import { DataProvider } from "@/core/store";
import { LoginScreen } from "@/app/LoginScreen";
import App from "@/app/App";

/**
 * Top-level auth boundary. Until a live API session exists, only the login
 * screen renders — the data store (which hydrates from the authenticated
 * GET /state) is mounted only once signed in.
 */
export function AuthGate() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}
