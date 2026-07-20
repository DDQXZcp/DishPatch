export type OrderStatus = "Preparing" | "Completed" | "Cancelled";

// Need Update
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  orderId: string;
  items: OrderItem[];
  status: OrderStatus;
}