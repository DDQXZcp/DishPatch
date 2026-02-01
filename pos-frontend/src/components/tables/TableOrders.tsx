import React from "react";
import { AUDFormatter } from "../../utils/currency";

interface Item {
  name: string;
  pricePerQuantity: number;
  quantity?: number;
  id: string;
}

interface Order {
  orderId: string;
  displayId: string;
  orderStatus: string;
  bills?: { total: number; tax: number; totalWithTax: number };
  items?: Item[];
}

interface TableOrdersProps {
  table: any;
  orders: Order[];
}

const TableOrders: React.FC<TableOrdersProps> = ({ table, orders }) => {
  if (!table) {
    return (
      <div className="text-center text-[#ababab] mt-10">
        Select a table to view details
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-white text-lg font-semibold mb-2 whitespace-nowrap">
        Orders for Table {table.tableNo}
      </h2>

      {orders.length === 0 ? (
        <p className="text-gray-400">No active orders</p>
      ) : (
        orders.map((order) => (
          <div key={order.displayId} className="mb-4">
            {/* Grey box only for ID + status */}
            <div className="bg-[#2a2a2a] p-3 rounded-lg text-white">
              <p className="text-sm whitespace-nowrap">
                Order #{order.displayId} — {order.orderStatus}
              </p>
            </div>

            {/* Items list */}
            <div className="ml-4 mt-2 text-sm text-gray-300 whitespace-nowrap">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => {
                  const qty = item.quantity ?? 1;
                  const total = item.pricePerQuantity * qty;
                  return (
                    <p key={idx}>
                      • {item.name} ×{qty} — {AUDFormatter.format(total)}
                    </p>
                  );
                })
              ) : (
                <p className="italic text-gray-500">No items</p>
              )}
            </div>

            {/* Totals */}
            {order.bills && (
              <p className="mt-2 text-right font-medium text-yellow-400">
                {AUDFormatter.format(order.bills.total || 0)}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TableOrders;