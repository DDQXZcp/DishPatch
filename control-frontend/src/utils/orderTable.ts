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

/**
 * How long a Preparing order may sit before it counts as late. Shared so the
 * age column in the order table and the "Order delayed" alert cannot end up
 * disagreeing about what "delayed" means.
 */
export const ORDER_OVERDUE_MS = 15 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Elapsed time in at most four characters, so the column stays narrow enough
 * not to crowd the rest of the row. Coarser the older it gets: minutes matter
 * while an order is cooking, days do not.
 */
export function formatOrderAge(createdAt: number, now: number): string {
  if (!Number.isFinite(createdAt)) {
    return '—';
  }

  // Clock skew between the POS and this browser can date an order slightly in
  // the future; report that as brand new rather than a negative age.
  const elapsed = Math.max(0, now - createdAt);

  if (elapsed < MINUTE_MS) {
    return '<1m';
  }

  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)}m`;
  }

  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}h`;
  }

  return `${Math.floor(elapsed / DAY_MS)}d`;
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
