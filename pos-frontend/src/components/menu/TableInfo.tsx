import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { formatDate } from "../../utils";
import { MdRestaurantMenu } from "react-icons/md";
import { getTables } from "../../https";
import { setCustomer } from "../../redux/slices/customerSlice";

const TableInfo = () => {
  const [dateTime] = useState(new Date());
  const [tables, setTables] = useState<any[]>([]);

  const dispatch = useDispatch();
  const customerData = useSelector((state: any) => state.customer);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const { data } = await getTables();
        const tableData = data.data || [];

        const sortedTables = tableData.sort((a: any, b: any) => {
          const [, aLetter, aNumber] = a.tableNo.match(/^([A-Z]+)(\d+)$/) || [];
          const [, bLetter, bNumber] = b.tableNo.match(/^([A-Z]+)(\d+)$/) || [];

          if (aLetter !== bLetter) return aLetter.localeCompare(bLetter);
          return Number(aNumber) - Number(bNumber);
        });

        setTables(sortedTables);
      } catch (error) {
        console.error("❌ Failed to fetch tables:", error);
      }
    };

    fetchTables();
  }, []);

  const handleSelectTable = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tableUuid = e.target.value;
    const table = tables.find((t) => t.uuid === tableUuid);

    if (table) {
      dispatch(
        setCustomer({
          ...customerData,
          table: {
            uuid: table.uuid,
            tableNo: table.tableNo,
            seats: table.seats,
            status: table.status,
          },
        })
      );
    }
  };

  return (
    <div className="mx-4 my-3 px-4 py-3 rounded-lg bg-yellow-100/80 border border-yellow-700/20 flex items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <MdRestaurantMenu className="text-[#6b3f12] text-3xl" />
        <h1 className="text-md text-[#6b3f12] font-semibold tracking-wide">
          Table
        </h1>
      </div>

      <div className="flex items-center gap-3">

        <div className="flex flex-col items-start">
          <select
            onChange={handleSelectTable}
            value={customerData.table?.uuid || ""}
            className="bg-yellow-50/80 text-[#6b3f12] border border-yellow-700/20 rounded-lg px-3 py-2 text-sm font-semibold outline-none cursor-pointer"
          >
            <option value="" disabled>
              Select Table
            </option>

            {tables.map((table) => (
              <option key={table.uuid} value={table.uuid}>
                Table {table.tableNo} ({table.status})
              </option>
            ))}
          </select>

          {/* <p className="text-xs text-[#6b3f12]/70 font-medium mt-1">
            {customerData.table?.seats
              ? `${customerData.table.seats} seats`
              : "No table selected"}
          </p> */}
        </div>
      </div>
    </div>
  );
};

export default TableInfo;