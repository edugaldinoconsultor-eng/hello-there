/**
 * Contrato HTTP genérico usado pelos services.
 *
 * Hoje: nenhum service faz fetch real — todos resolvem via mocks locais.
 * Futuro (Hostinger): trocar `dataSource` de "mock" para "http" e apontar
 * `API_BASE_URL` para o backend próprio. A UI não muda.
 */

export const API_BASE_URL = "/api"; // futuro: https://api.soulerp.com.br
export const dataSource: "mock" | "http" = "mock";

/** Formato padrão de resposta de sucesso da API futura. */
export type ApiOk<T> = { data: T; meta?: Record<string, unknown> };

/** Formato padrão de resposta de erro. */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export class ServiceError extends Error {
  code: ApiErrorCode;
  details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Placeholder para futuras requisições. Nunca chamado nesta etapa. */
export async function http<T>(_path: string, _init?: RequestInit): Promise<T> {
  throw new ServiceError(
    "INTERNAL_ERROR",
    "HTTP client não configurado — backend Hostinger ainda não conectado.",
  );
}
