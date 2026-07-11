import React from "react";
import { FaUserCircle } from "react-icons/fa";
import { IoLogOut } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError, AxiosResponse } from "axios";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../../redux/store";
import { useNavigate } from "react-router-dom";

import logo from "../../assets/images/HarbsLogo.png";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";

interface LogoutResponseData {
  success: boolean;
  message: string;
}

interface ErrorResponseData {
  message?: string;
}

const Header: React.FC = () => {
  const userData = useSelector((state: RootState) => state.user);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const logoutMutation = useMutation<
    AxiosResponse<LogoutResponseData>,
    AxiosError<ErrorResponseData>
  >({
    mutationFn: logout,

    onSuccess: () => {
      dispatch(removeUser());
      navigate("/auth");
    },

    onError: (error) => {
      console.error(error);
    },
  });

  const handleLogout = (): void => {
    logoutMutation.mutate();
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4 shadow-sm">
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex cursor-pointer items-center gap-3"
      >
        <img
          src={logo}
          alt="HARBS Logo"
          className="h-12 w-auto object-contain"
        />
      </button>

      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* User */}
        <div className="flex items-center gap-3">
          <FaUserCircle className="text-4xl text-text-secondary" />

          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {userData.name || "Guest"}
            </h2>

            <p className="text-xs text-text-secondary">
              {userData.role || "Staff"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="ml-2 rounded-xl p-2 text-text-secondary transition hover:bg-secondary-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IoLogOut size={28} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;