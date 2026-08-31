export type RobotStatus = 'Serving' | 'Returning' | 'Waiting' | 'Maintenance';

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
