/**
 * Service de Autenticação — agora chamando o backend real.
 * Base: https://api.infodanutri.com.br/api/v1
 */
import { apiFetch, ApiError } from "./api-client";
import {
  applyApiSession,
  clearApiSession,
  markAuthLoading,
  useSession,
  type ApiSessionPayload,
  type SessionUser,
} from "@/mocks/session";

async function fetchMe(): Promise<ApiSessionPayload | null> {
  try {
    return await apiFetch<ApiSessionPayload>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
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
    const payload = await apiFetch<ApiSessionPayload>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    applyApiSession(payload);
  },

  async logout(): Promise<void> {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } catch (err) {
      // Mesmo se falhar, limpamos o estado local.
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.warn("logout falhou:", err);
      }
    }
    clearApiSession();
  },

  async switchCompany(companyId: string | number): Promise<void> {
    const payload = await apiFetch<ApiSessionPayload>("/auth/switch-company", {
      method: "POST",
      body: { companyId },
    });
    applyApiSession(payload);
  },
};

export { useSession };
export type { SessionUser };
