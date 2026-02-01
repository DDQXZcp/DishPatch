import React from "react";
import { useNavigate } from "react-router-dom";
import { FaUtensils, FaListAlt, FaChair } from "react-icons/fa";

const UserManual: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="px-8 mt-6">
      <div className="bg-[#1a1a1a] w-full rounded-lg p-6">
        <h1 className="text-[#f5f5f5] text-lg font-semibold mb-4 tracking-wide">
          How to Use the POS
        </h1>

        <div className="flex flex-col gap-4">
          {/* Step 1 */}
          <div className="bg-[#2a2a2a] p-5 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">Step 1</h3>
              <p className="text-[#ababab] text-sm">
                Click the <strong>middle button</strong> below to open the{" "}
                <strong>Menu</strong> and take orders.
              </p>
            </div>
            <button
              onClick={() => navigate("/menu")}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg"
            >
              <FaUtensils /> Go to Menu
            </button>
          </div>

          {/* Step 2 */}
          <div className="bg-[#2a2a2a] p-5 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">Step 2</h3>
              <p className="text-[#ababab] text-sm">
                Track and manage orders in the <strong>Orders</strong> page.
              </p>
            </div>
            <button
              onClick={() => navigate("/orders")}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg"
            >
              <FaListAlt /> Go to Orders
            </button>
          </div>

          {/* Step 3 */}
          <div className="bg-[#2a2a2a] p-5 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">Step 3</h3>
              <p className="text-[#ababab] text-sm">
                After serving, go to the <strong>Tables</strong> page to handle
                payments and close the bill.
              </p>
            </div>
            <button
              onClick={() => navigate("/tables")}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg"
            >
              <FaChair /> Go to Tables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManual;