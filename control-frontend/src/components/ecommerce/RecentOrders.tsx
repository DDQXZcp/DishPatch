import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { Dropdown } from "../ui/dropdown/Dropdown";
import type { Robot, RobotStatus } from '../../types/Robot';
import { useRobotContext } from '../../context/RobotWebSocketProvider';

const ALL_STATUSES: RobotStatus[] = ['Serving', 'Pickup', 'Returning', 'Waiting', 'Maintenance'];

const STATUS_COLORS: Record<RobotStatus, string> = {
  Serving: 'bg-green-500',
  Pickup: 'bg-yellow-500',
  Returning: 'bg-blue-500',
  Waiting: 'bg-purple-500',
  Maintenance: 'bg-red-500',
};

interface RecentOrdersProps {
  framed?: boolean;
}

export default function RecentOrders({ framed = true }: RecentOrdersProps) {
  const { robots } = useRobotContext();
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<RobotStatus>>(new Set());

  const toggleFilter = (status: RobotStatus) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
  };

  const filteredRobots = activeFilters.size === 0
    ? robots
    : robots.filter((r) => activeFilters.has(r.status));

  const content = (
    <>
      <div className={`mb-4 flex flex-col gap-2 sm:flex-row sm:items-center ${
        framed ? "sm:justify-between" : "sm:justify-end"
      }`}>
        {framed && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Robot
            </h3>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`dropdown-toggle inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-theme-sm font-medium shadow-theme-xs ${
                activeFilters.size > 0
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-400 dark:bg-brand-900/20 dark:text-brand-400"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
              }`}
            >
              <svg
                className="stroke-current fill-white dark:fill-gray-800"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.29004 5.90393H17.7067"
                  stroke=""
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17.7075 14.0961H2.29085"
                  stroke=""
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12.0826 3.33331C13.5024 3.33331 14.6534 4.48431 14.6534 5.90414C14.6534 7.32398 13.5024 8.47498 12.0826 8.47498C10.6627 8.47498 9.51172 7.32398 9.51172 5.90415C9.51172 4.48432 10.6627 3.33331 12.0826 3.33331Z"
                  fill=""
                  stroke=""
                  strokeWidth="1.5"
                />
                <path
                  d="M7.91745 11.525C6.49762 11.525 5.34662 12.676 5.34662 14.0959C5.34661 15.5157 6.49762 16.6667 7.91745 16.6667C9.33728 16.6667 10.4883 15.5157 10.4883 14.0959C10.4883 12.676 9.33728 11.525 7.91745 11.525Z"
                  fill=""
                  stroke=""
                  strokeWidth="1.5"
                />
              </svg>
              Filter
              {activeFilters.size > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-brand-500 text-white text-xs">
                  {activeFilters.size}
                </span>
              )}
            </button>
            <Dropdown
              isOpen={filterOpen}
              onClose={() => setFilterOpen(false)}
              className="w-48 p-2"
            >
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleFilter(status)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                    activeFilters.has(status)
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {activeFilters.has(status) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
                  <span>{status}</span>
                </button>
              ))}
            </Dropdown>
          </div>
          <button
            onClick={clearFilters}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-theme-sm font-medium shadow-theme-xs ${
              activeFilters.size > 0
                ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
                : "border-gray-200 bg-gray-50 text-gray-400 cursor-default dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500"
            }`}
          >
            See all
          </button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 min-w-[130px]"
              >
                Robot
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 min-w-[80px]"
              >
                Speed
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 min-w-[80px]"
              >
                Battery
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 min-w-[80px]"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredRobots.map((robot: Robot) => (
              <TableRow key={robot.id} className="">
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-[50px] w-[50px] overflow-hidden rounded-md">
                      <img
                        src="/images/robot/robot-face-icon.svg"
                        className="h-[50px] w-[50px]"
                        alt={robot.name}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                        {robot.name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {robot.speed} kph
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {robot.battery}%
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  <Badge
                    size="sm"
                    color={
                      robot.status === "Serving"
                        ? "success"
                        : robot.status === "Pickup"
                        ? "warning"
                        : robot.status === "Returning"
                        ? "info"
                        : robot.status === "Waiting"
                        ? "purple"
                        : "error"  // Maintenance
                    }
                  >
                    {robot.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );

  if (!framed) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      {content}
    </div>
  );
}
