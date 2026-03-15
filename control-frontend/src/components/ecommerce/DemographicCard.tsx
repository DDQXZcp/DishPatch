import { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";
import CountryMap from "./CountryMap";
import ANUCampusMap from "../maps/ANUCampusMap";
import { useScooterContext } from "../../context/ScooterWebSocketProvider";

export default function DemographicCard() {
  const [isOpen, setIsOpen] = useState(false);
  const { scooters } = useScooterContext();

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  // Count scooter statuses
  const total = scooters.length;
  const runningCount = scooters.filter((s) => s.status === "Running").length;
  const lockedCount = scooters.filter((s) => s.status === "Locked").length;
  const maintenanceCount = scooters.filter((s) => s.status === "Maintenance").length;

  const getPercent = (count: number) =>
    total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="flex justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Scooter Operational Map
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Scooter operational status across the ANU campus
          </p>
        </div>
        <div className="relative inline-block">
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-40 p-2 z-[1001]"
          >
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              View More
            </DropdownItem>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="my-6 overflow-hidden border border-gray-200 rounded-2xl dark:border-gray-800">
        <div id="mapOne" className="mapOne map-btn h-[500px] w-full">
          <ANUCampusMap />
        </div>
      </div>

      <div className="space-y-5">
        {/* Running */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                Running Scooters
              </p>
              <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                {runningCount} Available for rent
              </span>
            </div>
          </div>
          <div className="flex w-full max-w-[140px] items-center gap-3">
            <div className="relative block h-2 w-full max-w-[100px] rounded-sm bg-gray-200 dark:bg-gray-800">
              <div
                className="absolute left-0 top-0 flex h-full items-center justify-center rounded-sm bg-green-500 text-xs font-medium text-white"
                style={{ width: `${getPercent(runningCount)}%` }}
              ></div>
            </div>
            <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
              {getPercent(runningCount)}%
            </p>
          </div>
        </div>

        {/* Locked */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                Locked Scooters
              </p>
              <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                {lockedCount} Currently in use
              </span>
            </div>
          </div>
          <div className="flex w-full max-w-[140px] items-center gap-3">
            <div className="relative block h-2 w-full max-w-[100px] rounded-sm bg-gray-200 dark:bg-gray-800">
              <div
                className="absolute left-0 top-0 flex h-full items-center justify-center rounded-sm bg-yellow-500 text-xs font-medium text-white"
                style={{ width: `${getPercent(lockedCount)}%` }}
              ></div>
            </div>
            <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
              {getPercent(lockedCount)}%
            </p>
          </div>
        </div>

        {/* Maintenance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                Under Maintenance
              </p>
              <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                {maintenanceCount} Being serviced
              </span>
            </div>
          </div>
          <div className="flex w-full max-w-[140px] items-center gap-3">
            <div className="relative block h-2 w-full max-w-[100px] rounded-sm bg-gray-200 dark:bg-gray-800">
              <div
                className="absolute left-0 top-0 flex h-full items-center justify-center rounded-sm bg-red-500 text-xs font-medium text-white"
                style={{ width: `${getPercent(maintenanceCount)}%` }}
              ></div>
            </div>
            <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
              {getPercent(maintenanceCount)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}