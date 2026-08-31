import { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";

interface UserData {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export default function UserInfoCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { userId } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
  
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${backendUrl}/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setUser(data.data);
        else setError(data.message || "Failed to load user info");
      })
      .catch(() => !cancelled && setError("Failed to load user info"))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = () => {
    // Handle save logic here
    console.log("Saving changes...");
    closeModal();
  };

  const [firstName, ...rest] = (user?.name ?? "").split(" ");
  const lastName = rest.join(" ")
  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            User Info
          </h4>

          {loading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          )}
          {error && !loading && <p className="text-sm text-error-500">{error}</p>}

          {!loading && !error && user && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                First Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {firstName || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Last Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {lastName || "-"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Email address
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user.email}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Phone
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user.phone || " "}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Bio
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                DishPatch Admin
              </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
