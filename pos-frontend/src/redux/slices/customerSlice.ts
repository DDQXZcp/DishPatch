import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CustomerTable {
  uuid: string;
  tableNo: string;
  seats: number;
  status: string;
}

export interface CustomerState {
  orderId: string;
  customerName: string;
  customerPhone: string;
  guests: number;
  table: CustomerTable | null;
}

interface SetCustomerPayload {
  name?: string;
  phone?: string;
  guests?: number;
  table?: CustomerTable | null;
}

interface UpdateTablePayload {
  table: CustomerTable | null;
}

const initialState: CustomerState = {
  orderId: "",
  customerName: "",
  customerPhone: "",
  guests: 0,
  table: null,
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    setCustomer: (
      state,
      action: PayloadAction<SetCustomerPayload>
    ) => {
      const { name, phone, guests, table } = action.payload;

      state.orderId = `${Date.now()}`;
      state.customerName = name ?? state.customerName;
      state.customerPhone = phone ?? state.customerPhone;
      state.guests = guests ?? state.guests;
      state.table = table ?? state.table;
    },

    removeCustomer: (state) => {
      state.orderId = "";
      state.customerName = "";
      state.customerPhone = "";
      state.guests = 0;
      state.table = null;
    },

    updateTable: (
      state,
      action: PayloadAction<UpdateTablePayload>
    ) => {
      state.table = action.payload.table;
    },
  },
});

export const {
  setCustomer,
  removeCustomer,
  updateTable,
} = customerSlice.actions;

export default customerSlice.reducer;