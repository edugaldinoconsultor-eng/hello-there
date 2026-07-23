/**
 * Service de Autenticação — fachada da UI.
 *
 * Hoje: expõe a sessão mock (DevRoleSwitcher).
 * Futuro: `login()` chamará POST /auth/login no backend Hostinger, receberá
 * um token (JWT ou cookie httpOnly) e o restante da app permanece igual.
 */
import {
  currentCompany,
  getCurrentUser,
  setCurrentUserId,
  useSession,
  type SessionUser,
} from "@/mocks/session";

export const authService = {
  me(): Promise<{ user: SessionUser; company: typeof currentCompany }> {
    return Promise.resolve({ user: getCurrentUser(), company: currentCompany });
  },
  /** Placeholder — troca de perfil no modo dev. */
  switchUser(userId: string): Promise<void> {
    setCurrentUserId(userId);
    return Promise.resolve();
  },
  /** Futuro: POST /auth/login. */
  login(_email: string, _password: string): Promise<never> {
    throw new Error("Login real ainda não implementado.");
  },
  /** Futuro: POST /auth/logout. */
  logout(): Promise<void> {
    return Promise.resolve();
  },
};

export { useSession };
export type { SessionUser };
