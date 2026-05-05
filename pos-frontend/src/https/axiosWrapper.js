import axios from "axios";

const defaultHeader = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Define the backend URL with a fallback for local development
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export const axiosWrapper = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
  headers: { ...defaultHeader },
});