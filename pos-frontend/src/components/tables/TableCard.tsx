import React from "react";
import { getAvatarName, getStableColor } from "../../utils";

// ✅ Define table and order types
interface Table {
  tableNo: string;
  status: "Available" | "Occupied";
  seats: number;
  customerName?: string | null;
}

interface Order {
  orderId: string;
  displayId: string;
  orderStatus: string;
}

interface TableCardProps {
  table: Table;
  orders?: Order[];
  onOpenModal: (table: Table) => void;
  onClearTable: (table: Table) => void;
  onSelectTable: (table: Table) => void;
}

const TableCard: React.FC<TableCardProps> = ({
  table,
  orders = [],
  onOpenModal,
  onClearTable,
  onSelectTable,
}) => {
  const handleClick = () => {
    onSelectTable(table); // open bill/order side panel
  };

  return (
    <div
      key={table.tableNo}
      className="w-[300px] hover:bg-[#2c2c2c] bg-[#262626] p-4 rounded-lg cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[#f5f5f5] text-xl font-semibold">
          Table {table.tableNo}
        </h1>
        <p
          className={`${
            table.status === "Occupied"
              ? "text-green-600 bg-[#2e4a40]"
              : "bg-[#664a04] text-white"
          } px-2 py-1 rounded-lg`}
        >
          {table.status}
        </p>
      </div>

      <div className="flex items-center justify-center mt-5 mb-8">
        <h1
          className="text-white rounded-full p-5 text-xl"
          style={{
            backgroundColor: table.customerName
              ? getStableColor(table.customerName)
              : "#1f1f1f",
          }}
        >
          {getAvatarName(table.customerName) || "N/A"}
        </h1>
      </div>

      <p className="text-[#ababab] text-xs mb-3">
        Seats: <span className="text-[#f5f5f5]">{table.seats}</span>
      </p>

      {/* ✅ Order Tags (green labels) */}
      <div className="flex flex-col gap-1 mb-3">
        {orders.map((order) => (
          <span
            key={order.displayId}
            className="bg-green-700 text-white text-xs px-2 py-1 rounded-lg w-fit"
          >
            Order #{order.displayId} — {order.orderStatus}
          </span>
        ))}

        {orders.length === 0 && (
          <span className="text-[#ababab] text-xs">No active orders</span>
        )}
      </div>

      {/* ✅ Always show Update Table button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal(table);
        }}
        className="w-full bg-yellow-600 text-white rounded-lg py-2 mb-2 hover:bg-yellow-700 transition"
      >
        Update Table
      </button>

      {/* ✅ Optional Clear button */}
      {table.status === "Occupied" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClearTable(table);
          }}
          className="w-full bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 transition"
        >
          Clear Table
        </button>
      )}
    </div>
  );
};

export default TableCard;