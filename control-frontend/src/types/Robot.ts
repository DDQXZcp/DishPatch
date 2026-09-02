export type RobotStatus = 'Serving' | 'Returning' | 'Waiting' | 'Maintenance';

/**
 * The statuses the dashboard actually surfaces, in display order.
 *
 * `Maintenance` is deliberately left out of the operator-facing lists.
 * Shared by the robot table's filter dropdown and the map legend so the two
 * cannot drift apart.
 */
export const DISPLAYED_ROBOT_STATUSES: RobotStatus[] = [
  'Serving',
  'Returning',
  'Waiting',
];

export interface Robot {
  id: number;
  name: string;
  status: RobotStatus;
  x: number;
  y: number;
  yaw: number;
  speed: number;
  battery: number;
  orderId?: string;
}

export interface RobotStats {
  servingCount: number;
  pickupCount: number;
  returningCount: number;
  waitingCount: number;
  maintenanceCount: number;
  totalCount: number;
  timestamp?: string;
}
