/**
 * Service de Clientes — fachada da UI.
 *
 * A UI importa APENAS deste arquivo. Trocar mocks por API futura significa
 * reimplementar as funções abaixo — nenhum componente precisa mudar.
 */
import {
  createCustomer as mockCreate,
  listCustomers as mockList,
  useCustomers as useCustomersMock,
  type Customer,
  type NewCustomerInput,
} from "@/mocks/customers";

export type { Customer, NewCustomerInput };

export const customersService = {
  list(companyId: string): Promise<Customer[]> {
    return Promise.resolve(mockList(companyId));
  },
  getById(companyId: string, id: string): Promise<Customer | undefined> {
    return Promise.resolve(mockList(companyId).find((c) => c.id === id));
  },
  create(companyId: string, input: NewCustomerInput): Promise<Customer> {
    return Promise.resolve(mockCreate(companyId, input));
  },
};

/** Hook reativo — hoje delega ao mock; amanhã pode virar useQuery. */
export const useCustomers = useCustomersMock;
