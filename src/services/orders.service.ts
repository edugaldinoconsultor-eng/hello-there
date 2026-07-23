/**
 * Service de Pedidos — fachada da UI.
 */
import {
  createOrder as mockCreate,
  findOrder as mockFind,
  listOrders as mockList,
  updateOrderStatus as mockUpdateStatus,
  useOrders as useOrdersMock,
  type NewOrderInput,
} from "@/mocks/orders";
import type { Order, OrderStatus } from "@/lib/order-types";

export type { Order, OrderStatus, NewOrderInput };

export const ordersService = {
  list(companyId: string): Promise<Order[]> {
    return Promise.resolve(mockList(companyId));
  },
  getById(companyId: string, id: string): Promise<Order | undefined> {
    return Promise.resolve(mockFind(companyId, id));
  },
  create(companyId: string, input: NewOrderInput): Promise<Order> {
    return Promise.resolve(mockCreate(companyId, input));
  },
  updateStatus(
    companyId: string,
    id: string,
    status: OrderStatus,
  ): Promise<Order | undefined> {
    return Promise.resolve(mockUpdateStatus(companyId, id, status));
  },
  cancel(companyId: string, id: string): Promise<Order | undefined> {
    return Promise.resolve(mockUpdateStatus(companyId, id, "cancelled"));
  },
};

export const useOrders = useOrdersMock;
