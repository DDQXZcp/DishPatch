import React, { useEffect, useState } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { MdRestaurantMenu } from "react-icons/md";
import MenuContainer from "../components/menu/MenuContainer";
import TableInfo from "../components/menu/TableInfo";
import CartInfo from "../components/menu/CartInfo";
import OrderSummary from "../components/menu/OrderSummary";
import { useSelector, useDispatch } from "react-redux";
import { getTables } from "../https";
import { setCustomer } from "../redux/slices/customerSlice";

const Menu: React.FC = () => {
  const dispatch = useDispatch();
  const customerData = useSelector((state: any) => state.customer);
  const [tables, setTables] = useState<any[]>([]);

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
        </div>

        <MenuContainer />
      </div>

      {/* Right Div */}
      <div className="flex-[1] bg-[#1a1a1a] mt-4 mr-3 rounded-lg flex flex-col pb-20">
        <div className="shrink-0">
          <TableInfo />
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