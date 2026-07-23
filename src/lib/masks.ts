/**
 * Máscaras e helpers de formatação para inputs brasileiros.
 * Puros / determinísticos — sem dependências externas.
 */

export const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCNPJ(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Detecta pelo tamanho: até 11 dígitos → CPF, acima → CNPJ. */
export function maskCpfCnpj(v: string) {
  const d = onlyDigits(v);
  return d.length <= 11 ? maskCPF(v) : maskCNPJ(v);
}

export function maskPhoneBR(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

/** Máscara monetária BRL. Recebe string do input e devolve "R$ 1.234,56". */
export function maskCurrencyBRL(v: string) {
  const d = onlyDigits(v);
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/** Converte string mascarada BRL → number (centavos preservados). */
export function parseCurrencyBRL(v: string): number {
  const d = onlyDigits(v);
  return d ? Number(d) / 100 : 0;
}

// ---------- validações leves ----------

export function isValidCPF(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += Number(d[i]) * (base + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCNPJ(cnpj: string) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: number) => {
    const weights =
      base === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base; i++) sum += Number(d[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function isValidCpfCnpj(v: string) {
  const d = onlyDigits(v);
  return d.length <= 11 ? isValidCPF(d) : isValidCNPJ(d);
}
