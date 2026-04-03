export type ScooterStatus = 'Serving' | 'Pickup' | 'Returning' | 'Waiting' | 'Maintenance';

export interface Scooter {
  id: number;
  name: string;
  status: ScooterStatus;
  x: number;
  y: number;
  speed: number;
  battery: number;
}