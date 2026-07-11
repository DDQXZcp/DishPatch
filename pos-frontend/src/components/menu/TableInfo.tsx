import { useEffect, useState } from "react";
import { MdRestaurantMenu } from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";

import { getTables } from "../../https";
import { setCustomer } from "../../redux/slices/customerSlice";
import type { AppDispatch, RootState } from "../../redux/store";

interface Table {
  uuid: string;
  tableNo: string;
  seats: number;
  status: string;
}

interface TablesResponse {
  data?: Table[];
}

const TableInfo = () => {
  const [tables, setTables] = useState<Table[]>([]);

  const dispatch = useDispatch<AppDispatch>();
  const customerData = useSelector(
    (state: RootState) => state.customer
  );

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await getTables();
        const responseData = response.data as TablesResponse;
        const tableData = responseData.data ?? [];

        const sortedTables = [...tableData].sort((a, b) => {
          const aMatch = a.tableNo.match(/^([A-Z]+)(\d+)$/);
          const bMatch = b.tableNo.match(/^([A-Z]+)(\d+)$/);

          if (!aMatch || !bMatch) {
            return a.tableNo.localeCompare(b.tableNo);
          }

          const [, aLetter, aNumber] = aMatch;
          const [, bLetter, bNumber] = bMatch;

          if (aLetter !== bLetter) {
            return aLetter.localeCompare(bLetter);
          }

          return Number(aNumber) - Number(bNumber);
        });

        setTables(sortedTables);
      } catch (error: unknown) {
        console.error("Failed to fetch tables:", error);
      }
    };

    void fetchTables();
  }, []);

  const handleSelectTable = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const tableUuid = event.target.value;
    const selectedTable = tables.find(
      (table) => table.uuid === tableUuid
    );

    if (!selectedTable) return;

    dispatch(
      setCustomer({
        ...customerData,
        table: {
          uuid: selectedTable.uuid,
          tableNo: selectedTable.tableNo,
          seats: selectedTable.seats,
          status: selectedTable.status,
        },
      })
    );
  };

  const selectedTable = customerData.table;

  return (
    <section className="m-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Table heading */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
            <MdRestaurantMenu className="text-xl text-primary" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Table
            </h2>

            {/* <p className="text-xs text-text-secondary">
              Choose a table for this order
            </p> */}
          </div>
        </div>

        {/* Table selector */}
        <select
          value={selectedTable?.uuid ?? ""}
          onChange={handleSelectTable}
          className="
            w-full cursor-pointer rounded-xl
            border border-border bg-background
            px-3 py-2.5 text-sm font-medium
            text-text-primary outline-none
            transition
            hover:border-border-strong
            focus:border-primary
            focus:ring-4 focus:ring-primary/10
            sm:w-auto sm:min-w-[180px]
          "
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
      </div>

      {/* Selected table details */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-secondary-light px-3 py-1 text-xs font-medium text-text-secondary">
          {selectedTable?.seats
            ? `${selectedTable.seats} seats`
            : "No table selected"}
        </span>

        {selectedTable?.status && (
          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
            {selectedTable.status}
          </span>
        )}
      </div>
    </section>
  );
};

export default TableInfo;