import type { ReactNode } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useSelector } from "react-redux";

import {
  Auth,
  Dashboard,
  Menu,
  Orders,
  Profile,
  Tables,
} from "./pages";

import Header from "./components/shared/Header";
import FullScreenLoader from "./components/shared/FullScreenLoader";

import useLoadData from "./hooks/useLoadData";

import type { RootState } from "./redux/store";

interface ProtectedRoutesProps {
  children: ReactNode;
}

const Layout = () => {
  const isLoading = useLoadData();
  const location = useLocation();

  const hideHeaderRoutes = ["/auth"];

  const { isAuth } = useSelector(
    (state: RootState) => state.user
  );

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && (
        <Header />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />

        <Route
          path="/auth"
          element={
            isAuth ? <Navigate to="/" replace /> : <Auth />
          }
        />

        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoutes>
              <Orders />
            </ProtectedRoutes>
          }
        />

        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoutes>
              <Profile />
            </ProtectedRoutes>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        />

        <Route
          path="*"
          element={<div>Not Found</div>}
        />
      </Routes>
    </>
  );
};

const ProtectedRoutes = ({
  children,
}: ProtectedRoutesProps) => {
  const { isAuth } = useSelector(
    (state: RootState) => state.user
  );

  if (!isAuth) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <Router>
      <div className="h-dvh overflow-hidden bg-background">
        <Layout />
      </div>
    </Router>
  );
};

export default App;