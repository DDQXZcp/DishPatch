import React, { useEffect, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdRestaurantMenu } from "react-icons/md";
import MenuContainer from "../components/menu/MenuContainer";
import OrderInfo from "../components/menu/OrderInfo";
import CartInfo from "../components/menu/CartInfo";
import OrderSummary from "../components/menu/OrderSummary";
import { useSelector, useDispatch } from "react-redux";
import { getTables } from "../https";
import { setCustomer } from "../redux/slices/customerSlice";

const Menu: React.FC = () => {
  const dispatch = useDispatch();
  const customerData = useSelector((state: any) => state.customer);
  const [tables, setTables] = useState<any[]>([]);

  useEffect(() => {
    document.title = "POS | Menu";

    const fetchTables = async () => {
      try {
        const { data } = await getTables();
        const tableData = data.data || [];

        // ✅ Sort tables by letter then number (A1, A2, B1, B2...)
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

  // ✅ Handle selecting a table
  const handleSelectTable = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tableNo = e.target.value;
    const table = tables.find((t) => t.tableNo === tableNo);

    if (table) {
      dispatch(
        setCustomer({
          ...customerData,
          table: { tableNo: table.tableNo, status: table.status },
        })
      );
    }
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* Left Div */}
      <div className="flex-[3]">
        <div className="flex items-center justify-between px-10 py-4">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Menu
            </h1>
          </div>

          {/* Right: Table Dropdown */}
          <div className="flex items-center gap-3 cursor-pointer">
            <MdRestaurantMenu className="text-[#f5f5f5] text-4xl" />
            <select
              onChange={handleSelectTable}
              value={customerData.table?.tableNo?.toString() || ""}
              className="bg-[#262626] text-[#f5f5f5] rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="" disabled>
                Select Table
              </option>
              {tables.map((table) => (
                <option key={table.tableNo} value={table.tableNo.toString()}>
                  Table {table.tableNo} ({table.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <MenuContainer />
      </div>

      {/* Right Div */}
      <div className="flex-[1] bg-[#1a1a1a] mt-4 mr-3 rounded-lg flex flex-col pb-20">
        <div className="shrink-0">
          <OrderInfo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <hr className="border-[#2a2a2a] border-t-2" />
          <CartInfo />
        </div>
        <div className="shrink-0">
          <hr className="border-[#2a2a2a] border-t-2" />
          <OrderSummary />
        </div>
      </div>

      <BottomNav />
    </section>
  );
};

export default Menu;