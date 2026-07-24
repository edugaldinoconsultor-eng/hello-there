import { useEffect, type ReactNode } from "react";
import { authService } from "@/services/auth.service";
import { useAuthStatus } from "@/mocks/session";
import { LoginScreen } from "./LoginScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStatus();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await authService.bootstrap();
      } catch (err) {
        if (!cancelled) console.error("bootstrap /auth/me falhou:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
