import React, { useState, useEffect } from "react";
import { GrRadialSelected } from "react-icons/gr";
import { useDispatch, useSelector } from "react-redux";
import { addItems, removeItem } from "../../redux/slices/cartSlice";
import { AUDFormatter } from "../../utils/currency";
import { getMenus } from "../../https"; // ✅ API helper
import useDragScroll from "../../hooks/useDragScroll";

const MenuContainer = () => {
  const [menus, setMenus] = useState([]);
  const [selected, setSelected] = useState(null);
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart);
  const dragScrollRef = useDragScroll();

  useEffect(() => {
    const loadMenus = async () => {
      try {
        const res = await getMenus();
        const data = res.data?.data || [];
        setMenus(data);
        if (data.length > 0) setSelected(data[0]);
      } catch (err) {
        console.error("❌ Error loading menus:", err);
      }
    };
    loadMenus();
  }, []);

  // ✅ Helper: get current quantity from cart
  const getCartQty = (item) => {
    const found = cart.find((i) => i.name === item.name);
    return found ? found.quantity : 0;
  };

  // ✅ When user clicks +
  const handleIncrement = (item) => {
    dispatch(
      addItems({
        id: item.id,
        name: item.name,
        pricePerQuantity: item.price,
      })
    );
  };

  // ✅ When user clicks –
  const handleDecrement = (item) => {
    dispatch(removeItem({ name: item.name }));
  };

  if (menus.length === 0) {
    return <p className="text-center text-gray-400 mt-10">Loading menus...</p>;
  }

  return (
    <>
      {/* Category grid */}
      <div className="flex flex-wrap gap-4 px-10 py-4">
        {menus.map((menu) => (
          <div
            key={menu.menuName}
            className="flex flex-col justify-between items-start p-4 rounded-lg cursor-pointer w-[200px] h-[100px]"
            style={{ backgroundColor: menu.bgColor }}
            onClick={() => setSelected(menu)}
          >
            <div className="flex items-center justify-between w-full">
              <h1 className="text-[#f5f5f5] text-lg font-semibold">
                {menu.icon} {menu.menuName}
              </h1>
              {selected?.menuName === menu.menuName && (
                <GrRadialSelected className="text-white" size={20} />
              )}
            </div>
            <p className="text-[#ababab] text-sm font-semibold">
              {menu.items?.length || 0} Items
            </p>
          </div>
        ))}
      </div>

      <hr className="border-[#2a2a2a] border-t-2 mt-4" />

      {/* Items grid */}
      <div
        ref={dragScrollRef}
        className="flex flex-wrap gap-4 px-10 py-4 cursor-grab scrollbar-hide select-none"
      >
        {selected?.items?.map((item, index) => (
          <div
            key={index}
            className="flex flex-col items-start justify-between p-4 rounded-lg h-[150px] w-[240px] cursor-pointer hover:bg-[#2a2a2a] bg-[#1a1a1a]"
          >
            <div className="flex items-start justify-between w-full">
              <h1 className="text-[#f5f5f5] text-lg font-semibold">
                {item.name}
              </h1>
            </div>

            <div className="flex items-center justify-between w-full">
              <p className="text-[#f5f5f5] text-xl font-bold">
                {AUDFormatter.format(item.price)}
              </p>
              <div className="flex items-center justify-between bg-[#1f1f1f] px-2 py-2 rounded-lg w-[90px]">
                <button
                  onClick={() => handleDecrement(item)}
                  className={`text-yellow-500 text-xl font-bold ${
                    getCartQty(item) === 0 ? "opacity-30 cursor-not-allowed" : ""
                  }`}
                  disabled={getCartQty(item) === 0}
                >
                  &minus;
                </button>

                <span className="text-white text-base font-semibold w-[20px] text-center">
                  {getCartQty(item)}
                </span>

                <button
                  onClick={() => handleIncrement(item)}
                  className="text-yellow-500 text-xl font-bold"
                >
                  &#43;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default MenuContainer;