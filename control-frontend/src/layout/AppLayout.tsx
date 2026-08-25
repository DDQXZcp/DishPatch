import { DashboardWidgetsProvider } from "../context/DashboardWidgetsContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";

const AppLayout: React.FC = () => {
  return (
    <DashboardWidgetsProvider>
      <div className="flex h-screen flex-col">
        <AppHeader />
        <div className="min-h-0 flex-1 overflow-y-auto p-4 w-full md:p-6">
          <Outlet />
        </div>
      </div>
    </DashboardWidgetsProvider>
  );
};

export default AppLayout;
