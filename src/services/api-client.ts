/**
 * Cliente HTTP central para o backend real do SoulERP (Hostinger).
 *
 * - `credentials: "include"` em todas as chamadas (cookie HttpOnly `soulerp_sid`).
 * - CSRF: lê o cookie `soulerp_csrf` (não HttpOnly) e envia em `X-CSRF-Token`
 *   para métodos que mutam estado (POST/PUT/PATCH/DELETE).
 * - Nunca lê nem tenta ler `soulerp_sid` (é HttpOnly).
 */

export const API_BASE_URL = "https://api.infodanutri.com.br/api/v1";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;
  /** Diagnóstico: URL efetivamente chamada (com base). */
  url?: string;
  /** Diagnóstico: método HTTP usado. */
  method?: string;
  /** Diagnóstico: se a requisição enviou cookies. */
  withCredentials?: boolean;
  /** Diagnóstico: corpo cru da resposta, como texto. */
  rawBody?: string;
  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}


const CSRF_COOKIE = "soulerp_csrf";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie ? document.cookie.split("; ") : [];
  for (const part of raw) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name === CSRF_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return part.slice(eq + 1);
      }
    }
  }
  return null;
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Envia CSRF mesmo em GET (raro). Default: envia em métodos não seguros. */
  csrf?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };

  const isUnsafe = method !== "GET";
  const needsCsrf = opts.csrf ?? isUnsafe;
  if (needsCsrf) {
    const token = readCsrfToken();
    if (token) headers["X-CSRF-Token"] = token;
  }

  let body: BodyInit | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (opts.body instanceof FormData || typeof opts.body === "string") {
      body = opts.body as BodyInit;
    } else {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      headers,
      body,
      signal: opts.signal,
    });
  } catch (err) {
    throw new ApiError(0, "NETWORK_ERROR", (err as Error).message || "Falha de rede");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!response.ok) {
    const p = (payload && typeof payload === "object" ? payload : {}) as {
      error?: { code?: string; message?: string; details?: unknown };
      message?: string;
    };
    const code = (p.error?.code as ApiErrorCode) ?? codeFromStatus(response.status);
    const message = p.error?.message ?? p.message ?? `HTTP ${response.status}`;
    // Diagnóstico temporário: log do payload cru para respostas de erro.
    // eslint-disable-next-line no-console
    console.warn(`[api-client] ${method} ${path} → ${response.status}`, payload);
    throw new ApiError(response.status, code, message, p.error?.details);
  }


  // API pode retornar { data: T } ou T diretamente.
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
