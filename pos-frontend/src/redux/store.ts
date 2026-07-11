import { configureStore } from "@reduxjs/toolkit";
import customerReducer from "./slices/customerSlice";
import cartReducer from "./slices/cartSlice";
import userReducer from "./slices/userSlice";

const store = configureStore({
  reducer: {
    customer: customerReducer,
    cart: cartReducer,
    user: userReducer,
  },

  devTools: import.meta.env.MODE !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;