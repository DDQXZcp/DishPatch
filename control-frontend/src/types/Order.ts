export type OrderStatus =
  | "Preparing"
  | "Completed"
  | "Cancelled";

export interface OrderItem {
  name?: string;
  itemName?: string;
  productName?: string;

  quantity?: number;
  qty?: number;

  [key: string]: unknown;
}

export interface Order {
  /**
   * DynamoDB partition key.
   * Keep this for React keys and future update requests.
   */
  orderId: string;

  /**
   * Short four-digit ID displayed in the control frontend.
   */
  displayId: string;

  items: OrderItem[];

  tableNo?: string | number;

  table?:
    | string
    | number
    | {
        tableNo?: string | number;
    };
  orderStatus: OrderStatus;

  orderDate: string;
}

export interface OrdersApiResponse {
  success: boolean;
  message: string | null;
  data: Order[];
}