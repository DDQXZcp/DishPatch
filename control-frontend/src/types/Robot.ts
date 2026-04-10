export type RobotStatus = 'Serving' | 'Pickup' | 'Returning' | 'Waiting' | 'Maintenance';

export interface Robot {
  id: number;
  name: string;
  status: RobotStatus;
  x: number;
  y: number;
  speed: number;
  battery: number;
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
