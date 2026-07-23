/**
 * Schema Zod do formulário de Novo Cliente.
 * Fonte única de verdade para validação client-side; o mesmo schema
 * poderá ser reutilizado em server functions quando o backend existir.
 */
import { z } from "zod";
import { isValidCpfCnpj, onlyDigits } from "./masks";

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export const PAYMENT_TERMS = [
  { value: "a_vista", label: "À vista" },
  { value: "7_dias", label: "7 dias" },
  { value: "14_dias", label: "14 dias" },
  { value: "21_28", label: "21/28 dias" },
  { value: "30_dias", label: "30 dias" },
  { value: "30_60", label: "30/60 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
  { value: "faturado", label: "Faturado" },
] as const;

export const PRICE_TABLES = [
  { value: "atacado", label: "Atacado" },
  { value: "varejo", label: "Varejo" },
  { value: "vip", label: "VIP" },
  { value: "diamante", label: "Diamante" },
] as const;

/** Vendedores mock — substituir por consulta real futuramente. */
export const MOCK_SALESPEOPLE = [
  { id: "sp_001", name: "Ana Souza" },
  { id: "sp_002", name: "Bruno Lima" },
  { id: "sp_003", name: "Carla Nogueira" },
  { id: "sp_004", name: "Diego Ramos" },
];

export const customerFormSchema = z.object({
  personType: z.enum(["PF", "PJ"]),

  legalName: z
    .string()
    .trim()
    .min(2, "Informe o nome / razão social")
    .max(150, "Máximo de 150 caracteres"),
  tradeName: z.string().trim().max(150).optional().or(z.literal("")),

  document: z
    .string()
    .min(1, "Informe o CPF ou CNPJ")
    .refine((v) => isValidCpfCnpj(v), "CPF/CNPJ inválido"),

  phone: z
    .string()
    .min(1, "Informe o telefone")
    .refine((v) => {
      const d = onlyDigits(v).length;
      return d === 10 || d === 11;
    }, "Telefone inválido"),

  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(150)
    .optional()
    .or(z.literal("")),

  address: z.object({
    cep: z
      .string()
      .optional()
      .refine((v) => !v || onlyDigits(v).length === 8, "CEP inválido"),
    street: z.string().trim().max(150).optional().or(z.literal("")),
    number: z.string().trim().max(20).optional().or(z.literal("")),
    complement: z.string().trim().max(80).optional().or(z.literal("")),
    district: z.string().trim().max(80).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    state: z.enum(UF_LIST).optional().or(z.literal("")),
  }),

  commercial: z.object({
    salespersonId: z.string().optional().or(z.literal("")),
    priceTable: z.enum(["atacado", "varejo", "vip", "diamante"]),
    creditLimit: z.number().min(0, "Valor inválido"),
    paymentTerm: z.enum([
      "a_vista",
      "7_dias",
      "14_dias",
      "21_28",
      "30_dias",
      "30_60",
      "30_60_90",
      "faturado",
    ]),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  }),

  status: z.object({
    active: z.boolean(),
    diamond: z.boolean(),
  }),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
