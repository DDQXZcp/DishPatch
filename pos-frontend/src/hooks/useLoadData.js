import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";

const useLoadData = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        console.log("useLoadData response:", data);

        // ✅ Adapt to DynamoDB: backend sends { userId, ... }
        const { userId, name, email, phone, role } = data.data || data;

        dispatch(setUser({ userId, name, email, phone, role }));
      } catch (error) {
        console.log("useLoadData error:", error);
        dispatch(removeUser());

        // ✅ use navigate(), not Navigate
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;