export type ScooterStatus = 'Running' | 'Locked' | 'Maintenance';

export interface Scooter {
  id: number;
  name: string;
  status: ScooterStatus;
  lat: number;
  lng: number;
  speed: number;
  battery: number;
}