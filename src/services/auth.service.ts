/**
 * Service de Autenticação — agora chamando o backend real.
 * Base: https://api.infodanutri.com.br/api/v1
 */
import { apiFetch, ApiError, setUnauthorizedHandler, setCsrfToken } from "./api-client";
import {
  applyApiSession,
  clearApiSession,
  markAuthLoading,
  getAuthStatus,
  useSession,
  type ApiSessionPayload,
  type SessionUser,
} from "@/mocks/session";

// Registra tratamento GLOBAL de 401: qualquer chamada autenticada que
// retornar UNAUTHORIZED derruba a sessão local imediatamente, forçando
// o AuthGate a exibir a LoginScreen.
setUnauthorizedHandler(({ url, method }) => {
  if (getAuthStatus() !== "unauthenticated") {
    console.warn(`[auth] Sessão derrubada por 401 em ${method} ${url}`);
    setCsrfToken(null);
    clearApiSession();
  }
});

type MePayload = ApiSessionPayload & { csrf_token?: string };

async function fetchMe(): Promise<MePayload | null> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  try {
    return await apiFetch<MePayload>("/auth/me", { signal: ctrl?.signal });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const authService = {
  /** Bootstrap: consulta /auth/me e hidrata a sessão. Nunca deixa em loading. */
  async bootstrap(): Promise<boolean> {
    markAuthLoading();
    try {
      const me = await fetchMe();
      if (!me) {
        clearApiSession();
        return false;
      }
      applyApiSession(me);
      return true;
    } catch (err) {
      console.error("bootstrap /auth/me falhou:", err);
      clearApiSession();
      return false;
    }
  },

  async me(): Promise<ApiSessionPayload | null> {
    return fetchMe();
  },

  async login(email: string, password: string): Promise<void> {
    // Login não envia CSRF.
    const payload = await apiFetch<ApiSessionPayload & { csrf_token?: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    // Cross-site: cookie `soulerp_csrf` é 3rd-party e invisível ao JS.
    // Guardamos o token ecoado no corpo para usar no header X-CSRF-Token.
    if (payload && typeof payload === "object" && typeof payload.csrf_token === "string") {
      setCsrfToken(payload.csrf_token);
    }
    applyApiSession(payload);
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.warn("logout falhou:", err);
      }
    }
    setCsrfToken(null);
    clearApiSession();
  },

  async switchCompany(companyId: string | number): Promise<void> {
    const payload = await apiFetch<ApiSessionPayload & { csrf_token?: string }>("/auth/switch-company", {
      method: "POST",
      body: { companyId },
    });
    if (payload && typeof payload === "object" && typeof payload.csrf_token === "string") {
      setCsrfToken(payload.csrf_token);
    }
    applyApiSession(payload);
  },
};

export { useSession };
export type { SessionUser };
