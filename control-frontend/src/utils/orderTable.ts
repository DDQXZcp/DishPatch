import type { Order, OrderItem } from '../types/Order';

export interface OrderTableInfo {
  displayId: string;
  tableNo: string;
  items: OrderItem[];
}

export function resolveOrderTableNo(order: Order): string | undefined {
  const value =
    order.tableNo ??
    (typeof order.table === 'object' ? order.table?.tableNo : order.table);

  return value === undefined || value === null || value === '' ? undefined : String(value);
}

export function formatOrderItemLine(item: OrderItem): string {
  const name = item.name ?? item.itemName ?? item.productName ?? 'Item';
  const quantity = item.quantity ?? item.qty ?? 1;

  return `${quantity} × ${name}`;
}

export function buildOrderTableIndex(orders: Order[] | null | undefined): Map<string, OrderTableInfo> {
  const next = new Map<string, OrderTableInfo>();

  (orders ?? []).forEach((order) => {
    const tableNo = resolveOrderTableNo(order);

    if (tableNo) {
      next.set(order.orderId, { displayId: order.displayId, tableNo, items: order.items });
    }
  });

  return next;
}
