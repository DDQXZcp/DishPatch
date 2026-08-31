import { DashboardWidgetsProvider } from "../context/DashboardWidgetsContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import { AlertsProvider } from "../components/dashboard/AlertsNotificationsWidget";

const AppLayout: React.FC = () => {
  return (
    <DashboardWidgetsProvider>
      {/* Alert bookkeeping lives above the Outlet so dismissals, event
          timestamps and the order baseline survive page navigation. The
          snackbars themselves still render only on the dashboard. */}
      <AlertsProvider>
        <div className="flex h-screen flex-col">
          <AppHeader />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 w-full md:p-6">
            <Outlet />
          </div>
        </div>
      </AlertsProvider>
    </DashboardWidgetsProvider>
  );
};

export default AppLayout;
