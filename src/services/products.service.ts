/**
 * Service de Produtos — fachada da UI.
 */
import {
  findProduct as mockFind,
  listProducts as mockList,
  useProducts as useProductsMock,
  type Product,
} from "@/mocks/products";

export type { Product };

export const productsService = {
  list(companyId: string): Promise<Product[]> {
    return Promise.resolve(mockList(companyId));
  },
  getById(companyId: string, id: string): Promise<Product | undefined> {
    return Promise.resolve(mockFind(companyId, id));
  },
};

export const useProducts = useProductsMock;
