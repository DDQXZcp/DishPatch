export interface CustomerDetails {
  name: string;
  phone?: string;
  guests?: number;
}

export interface BillDetails {
  total: number;
  tax: number;
  totalWithTax: number;
}

export interface Item {
  id: string;
  name: string;
  pricePerQuantity: number;
  quantity?: number;
}

export interface Order {
  orderId: string;      // full UUID
  displayId: string;    // short 4-digit code
  orderStatus: "Preparing" | "Ready" | "Served" | "Paid" | "Cancelled" | string;
  orderDate: string;
  customerDetails: CustomerDetails;
  bills?: BillDetails;
  items?: Item[];
  table?: { tableNo: string } | string;
}