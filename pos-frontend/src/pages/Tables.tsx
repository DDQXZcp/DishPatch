import React, { useState, useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import TableCard from "../components/tables/TableCard";
import Modal from "../components/shared/Modal";
import TableOrders from "../components/tables/TableOrders";
import CustomerInfo from "../components/tables/CustomerInfo";
import Bill from "../components/tables/Bill";
import { useSnackbar } from "notistack";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getTables, updateTable, getOrders } from "../https";
import useDragScroll from "../hooks/useDragScroll";

interface Order {
  orderId: string;
  displayId: string;
  orderStatus: string;
  tableNo: string;
  items: Array<{ name: string; price: number; quantity: number }>;
}

const Tables = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState("all");
  const [selectedTable, setSelectedTable] = useState<any>(null);

  // modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  const queryClient = useQueryClient();
  const dragScrollRef = useDragScroll();

  useEffect(() => {
    document.title = "POS | Tables";
  }, []);

  const { data: resData, isError } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => await getTables(),
    placeholderData: keepPreviousData,
  });

  const { data: orderRes } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => await getOrders(),
    placeholderData: keepPreviousData,
  });

  const orders = orderRes?.data?.data || [];

  // ✅ Error handling
  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  // ✅ Update table mutation
  const mutation = useMutation({
    mutationFn: (payload: any) => updateTable(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });

  const mutationClear = useMutation({
    mutationFn: (payload: any) => updateTable(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      enqueueSnackbar("Table cleared successfully!", { variant: "success" });
    },
    onError: () => {
      enqueueSnackbar("Failed to clear table", { variant: "error" });
    },
  });

  const handleClearTable = (table: any) => {
    mutationClear.mutate({
      tableNo: table.tableNo,
      status: "Available",
      seats: table.seats,
      customerName: null,
      customerPhone: null,
      guests: 0,
    });
    setSelectedTable(null); // clear side panel
  };

  // ✅ Open modal for update
  const handleOpenModal = (table: any) => {
    setSelectedTable(table);
    setCustomerName(table.customerName || "");
    setCustomerPhone(table.customerPhone || "");
    setGuestCount(table.guests || 1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleUpdateTable = () => {
    if (!selectedTable) return;

    const payload = {
      tableNo: selectedTable.tableNo,
      seats: selectedTable.seats,
      status: "Occupied",
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      guests: guestCount,
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["tables"] });
        enqueueSnackbar("Table updated successfully!", { variant: "success" });
        closeModal();
        setSelectedTable((prev: any) =>
          prev ? { ...prev, ...payload } : prev
        );
      },
      onError: () => {
        enqueueSnackbar("Failed to update table", { variant: "error" });
      },
    });
  };

  // ✅ Filter tables
  const tables = resData?.data.data || [];
  // ✅ Filter + Sort tables (A1, A2, A3, ..., B1, B2, ...)
  const filteredTables = (status === "all"
    ? tables
    : tables.filter((t: any) => t.status === status)
  ).sort((a: any, b: any) => {
    // Extract letter and number parts (e.g. A1 -> A, 1)
    const [, aLetter, aNumber] = a.tableNo.match(/^([A-Z]+)(\d+)$/) || [];
    const [, bLetter, bNumber] = b.tableNo.match(/^([A-Z]+)(\d+)$/) || [];

    // Sort by letter first (A < B < C)
    if (aLetter !== bLetter) {
      return aLetter.localeCompare(bLetter);
    }

    // Then sort numerically (1 < 2 < 3)
    return Number(aNumber) - Number(bNumber);
  });

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* Left: Tables grid */}
      <div className="flex-[3]">
        <div className="flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Tables
            </h1>
          </div>
          <div className="flex items-center justify-around gap-4">
            {["all", "Occupied", "Available"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-[#ababab] text-lg ${
                  status === s && "bg-[#383838] rounded-lg px-5 py-2"
                } rounded-lg px-5 py-2 font-semibold`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={dragScrollRef}
          className="flex flex-wrap items-start gap-6 px-10 py-4 overflow-y-auto h-[calc(100vh-14rem)] cursor-grab scrollbar-hide select-none"
        >
          {filteredTables.map((table: any) => {
            const tableOrders = orders.filter(
              (o: any) => o.tableNo === table.tableNo
            );
            return (
              <TableCard
                key={table.tableNo}
                table={table}
                orders={tableOrders.map((o: any) => ({
                  orderId: o.orderId,
                  displayId: o.displayId,
                  orderStatus: o.orderStatus,
                  items: o.items || [],
                }))}
                onSelectTable={(t: any) => setSelectedTable(t)}
                onOpenModal={handleOpenModal}
                onClearTable={handleClearTable}
              />
            );
          })}
        </div>
      </div>

      {/* Right: Orders for selected table */}
      <div className="flex-[1] bg-[#1a1a1a] mt-4 mr-3 rounded-lg flex flex-col pb-20">
        {/* Top: Customer info */}
        <div className="shrink-0">
          <CustomerInfo table={selectedTable} />
          <hr className="border-[#2a2a2a] border-t-2" />
        </div>

        {/* Middle: Orders (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          <TableOrders
            table={selectedTable}
            orders={orders
              .filter(
                (o: any) =>
                  selectedTable && o.tableNo === selectedTable.tableNo
              )
              .map((o: any) => ({
                orderId: o.orderId,
                displayId: o.displayId,
                orderStatus: o.orderStatus,
                items: o.items || [],
              }))}
          />
        </div>

        {/* Bottom: Bill (fixed at bottom) */}
        <div className="shrink-0">
          <hr className="border-[#2a2a2a] border-t-2" />
          <Bill
            table={selectedTable}
            orders={orders.filter(
              (o: Order) => selectedTable && o.tableNo === selectedTable.tableNo
            )}
          />
        </div>
      </div>

      {/* ✅ Modal for Update Table */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Update Table">
        <div>
          <label className="block text-[#ababab] mb-2 text-sm font-medium">
            Customer Name
          </label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              type="text"
              placeholder="Enter customer name"
              className="bg-transparent flex-1 text-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[#ababab] mb-2 mt-3 text-sm font-medium">
            Customer Phone
          </label>
          <div className="flex items-center rounded-lg p-3 px-4 bg-[#1f1f1f]">
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
              placeholder="04xx xxx xxx"
              className="bg-transparent flex-1 text-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 mt-3 text-sm font-medium text-[#ababab]">
            Guest
          </label>
          <div className="flex items-center justify-between bg-[#1f1f1f] px-4 py-3 rounded-lg">
            <button
              onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
              className="text-yellow-500 text-2xl"
            >
              &minus;
            </button>
            <span className="text-white">{guestCount} Person</span>
            <button
              onClick={() => setGuestCount((c) => c + 1)}
              className="text-yellow-500 text-2xl"
            >
              &#43;
            </button>
          </div>
        </div>

        <button
          onClick={handleUpdateTable}
          disabled={mutation.isPending}
          className="w-full bg-[#F6B100] text-[#f5f5f5] rounded-lg py-3 mt-8 hover:bg-yellow-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Updating..." : "Update Table"}
        </button>
      </Modal>

      <BottomNav />
    </section>
  );
};

export default Tables;