import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError, AxiosResponse } from "axios";
import { enqueueSnackbar } from "notistack";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { login } from "../../https/index";
import { setUser } from "../../redux/slices/userSlice";

interface LoginFormData {
  email: string;
  password: string;
}

interface User {
  userId: string;
  name: string;
  email: string;
}

interface LoginResponseData {
  success: boolean;
  message: string;
  data: User;
}

interface ErrorResponseData {
  message?: string;
}

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate(formData);
  };

  const handleGuestLogin = () => {
    const guestCredentials: LoginFormData = {
      email: "guest@anu.edu.au",
      password: "guest",
    };

    loginMutation.mutate(guestCredentials);
  };

  const loginMutation = useMutation<
    AxiosResponse<LoginResponseData>,
    AxiosError<ErrorResponseData>,
    LoginFormData
  >({
    mutationFn: (requestData) => login(requestData),

    onSuccess: (response) => {
      // Backend response:
      // {
      //   success: true,
      //   message: "...",
      //   data: {
      //     userId,
      //     name,
      //     email,
      //     ...
      //   }
      // }

      const user = response.data.data;
      const { userId, name, email } = user;

      dispatch(
        setUser({
          userId,
          name,
          email,
        })
      );

      enqueueSnackbar(response.data.message, {
        variant: "success",
      });

      navigate("/");
    },

    onError: (error) => {
      const message =
        error.response?.data?.message ||
        "Unable to sign in. Please check your details and try again.";

      enqueueSnackbar(message, {
        variant: "error",
      });
    },
  });

  return (
    <div className="font-sans">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Staff email */}
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Staff Email
          </label>

          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter staff email"
            autoComplete="email"
            required
            className="
              w-full rounded-xl border border-border bg-surface
              px-4 py-4 text-base text-text-primary
              placeholder:text-text-muted
              outline-none transition duration-200
              hover:border-border-strong
              focus:border-primary
              focus:ring-4 focus:ring-primary/10
            "
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter password"
            autoComplete="current-password"
            required
            className="
              w-full rounded-xl border border-border bg-surface
              px-4 py-4 text-base text-text-primary
              placeholder:text-text-muted
              outline-none transition duration-200
              hover:border-border-strong
              focus:border-primary
              focus:ring-4 focus:ring-primary/10
            "
          />
        </div>

        {/* Sign-in button */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="
            mt-2 w-full rounded-xl bg-primary px-4 py-4
            text-base font-semibold text-white
            transition duration-200
            hover:bg-primary-hover
            focus:outline-none
            focus:ring-4 focus:ring-primary/20
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />

        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          or
        </span>

        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Guest sign-in button */}
      <button
        type="button"
        onClick={handleGuestLogin}
        disabled={loginMutation.isPending}
        className="
          w-full rounded-xl border border-border bg-surface
          px-4 py-4 text-base font-semibold text-secondary
          transition duration-200
          hover:border-border-strong
          hover:bg-secondary-light
          focus:outline-none
          focus:ring-4 focus:ring-secondary/10
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >
        Guest Sign In
      </button>
    </div>
  );
};

export default Login;