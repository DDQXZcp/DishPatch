import React, { useEffect, useRef } from "react";
import { RiDeleteBin2Fill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import {
  removeItemCompletely,
  removeAllItems,
} from "../../redux/slices/cartSlice";
import { AUDFormatter } from "../../utils/currency";

const CartInfo = () => {
  const cartData = useSelector((state) => state.cart);
  const scrollRef = useRef();
  const dispatch = useDispatch();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [cartData]);

  const handleRemove = (item) => {
    dispatch(removeItemCompletely({ uuid: item.uuid }));
  };

  const handleRemoveAll = () => {
    dispatch(removeAllItems());
  };

  return (
    <div className="px-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg text-[#f5f5f5] font-semibold tracking-wide">
          Order Items
        </h1>

        <button
          onClick={handleRemoveAll}
          disabled={cartData.length === 0}
          className={`bg-yellow-100/80 border border-yellow-700/20 rounded-lg p-2 ${
            cartData.length === 0
              ? "opacity-30 cursor-not-allowed"
              : "cursor-pointer hover:bg-yellow-100"
          }`}
          title="Remove all items"
        >
          <RiDeleteBin2Fill className="text-[#6b3f12]" size={18} />
        </button>
      </div>

      <div className="mt-4 overflow-y-scroll scrollbar-hide" ref={scrollRef}>
        {cartData.map((item) => {
          return (
            <div
              key={item.uuid}
              className="bg-yellow-100/80 border border-yellow-700/20 rounded-lg px-4 py-4 mb-2 hover:bg-yellow-100"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-[#6b3f12] font-semibold tracking-wide text-md">
                  {item.name}
                </h1>

                <p className="text-[#6b3f12]/80 font-semibold">
                  x{item.quantity}
                </p>
              </div>

              <div className="flex items-center justify-between mt-3">
                <RiDeleteBin2Fill
                  onClick={() => handleRemove(item)}
                  className="text-[#6b3f12] cursor-pointer hover:opacity-70"
                  size={20}
                />

                <p className="text-[#6b3f12] text-md font-bold">
                  {AUDFormatter.format(item.price)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartInfo;