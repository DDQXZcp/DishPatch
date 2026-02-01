import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // ➕ Add or increase quantity
    addItems: (state, action) => {
      const existing = state.find(item => item.name === action.payload.name);
      if (existing) {
        existing.quantity += 1;
        existing.price = existing.quantity * existing.pricePerQuantity;
      } else {
        state.push({
          ...action.payload,
          quantity: 1,
          price: action.payload.pricePerQuantity,
        });
      }
    },

    // ➖ Decrease quantity or remove item
    removeItem: (state, action) => {
      const existing = state.find(item => item.name === action.payload.name);
      if (existing) {
        if (existing.quantity > 1) {
          existing.quantity -= 1;
          existing.price = existing.quantity * existing.pricePerQuantity;
        } else {
          // remove if quantity hits 0
          return state.filter(item => item.name !== action.payload.name);
        }
      }
      return state;
    },

    // 🗑️ Clear all items
    removeAllItems: () => [],
  },
});

export const getTotalPrice = (state) =>
  state.cart.reduce((total, item) => total + item.price, 0);

export const { addItems, removeItem, removeAllItems } = cartSlice.actions;
export default cartSlice.reducer;