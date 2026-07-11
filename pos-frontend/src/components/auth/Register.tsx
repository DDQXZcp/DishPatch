import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError, AxiosResponse } from "axios";
import { enqueueSnackbar } from "notistack";
import { register } from "../../https";

interface RegisterProps {
  setIsRegister: React.Dispatch<React.SetStateAction<boolean>>;
}

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
}

interface RegisterResponseData {
  message: string;
}

interface ErrorResponseData {
  message?: string;
}

const Register: React.FC<RegisterProps> = ({ setIsRegister }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
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
    registerMutation.mutate(formData);
  };

  const registerMutation = useMutation<
    AxiosResponse<RegisterResponseData>,
    AxiosError<ErrorResponseData>,
    RegisterFormData
  >({
    mutationFn: (requestData) => register(requestData),

    onSuccess: (response) => {
      const message =
        response.data.message || "Account created successfully.";

      enqueueSnackbar(message, {
        variant: "success",
      });

      setFormData({
        name: "",
        email: "",
        password: "",
      });

      setTimeout(() => {
        setIsRegister(false);
      }, 1500);
    },

    onError: (error) => {
      const message =
        error.response?.data?.message ||
        "Unable to create the account. Please try again.";

      enqueueSnackbar(message, {
        variant: "error",
      });
    },
  });

  return (
    <div className="font-sans">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Staff Name */}
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            Staff Name
          </label>

          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter staff name"
            autoComplete="name"
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

        {/* Staff Email */}
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
            autoComplete="new-password"
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

        {/* Sign Up Button */}
        <button
          type="submit"
          disabled={registerMutation.isPending}
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
          {registerMutation.isPending ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
};

export default Register;