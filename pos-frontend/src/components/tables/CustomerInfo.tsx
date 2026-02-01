import React from "react";
import { formatDate, getAvatarName } from "../../utils";

interface Table {
  tableNo: string;
  customerName?: string | null;
  orderId?: string | null;
}

interface CustomerInfoProps {
  table: Table | null;
}

const CustomerInfo: React.FC<CustomerInfoProps> = ({ table }) => {
  if (!table) {
    return (
      <div className="flex items-center justify-center px-4 py-3 text-[#ababab]">
        No table selected
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col items-start">
        <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
          {table.customerName || "Customer"}
        </h1>
        <p className="text-xs text-[#ababab] font-medium mt-1">
          Table {table.tableNo || "N/A"} / Dine in
        </p>
        <p className="text-xs text-[#ababab] font-medium mt-2">
          {formatDate(new Date())}
        </p>
      </div>
      <button className="bg-[#f6b100] p-3 text-xl font-bold rounded-lg">
        {getAvatarName(table.customerName) || "CN"}
      </button>
    </div>
  );
};

export default CustomerInfo;