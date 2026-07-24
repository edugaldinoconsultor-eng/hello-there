import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { authService } from "@/services/auth.service";
import { ApiError } from "@/services/api-client";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("E-mail ou senha inválidos.");
        else if (err.status === 429) setError("Muitas tentativas. Tente novamente em instantes.");
        else setError(err.message || "Não foi possível entrar.");
      } else {
        setError("Falha de conexão com o servidor.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">SoulERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre com sua conta corporativa</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-foreground">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Conectado a api.infodanutri.com.br
        </p>
      </div>
    </div>
  );
}
