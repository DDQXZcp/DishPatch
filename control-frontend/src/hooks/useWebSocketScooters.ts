import { useState, useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';

interface ScooterData {
  id: number;
  name: string; // 👈 Add this line
  lat: number;
  lng: number;
  battery: number;
  status: 'Running' | 'Locked' | 'Maintenance';
}

interface ScooterStats {
  runningCount: number;
  lockedCount: number;
  maintenanceCount: number;
  totalCount: number;
  runningPercentage: number;
  lockedPercentage: number;
  maintenancePercentage: number;
}

export const useWebSocketScooters = () => {
  const [scooters, setScooters] = useState<ScooterData[]>([]);
  const [stats, setStats] = useState<ScooterStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stompClient = useRef<Client | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

  useEffect(() => {
    const connect = () => {
      try {
        stompClient.current = new Client({
          webSocketFactory: () => new SockJS(`${backendUrl}/ws`),
          connectHeaders: {},
          debug: (str) => {
            console.log('STOMP: ' + str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          onConnect: (frame) => {
            console.log('Connected to WebSocket:', frame);
            setIsConnected(true);
            setError(null);

            // Subscribe to scooter locations
            stompClient.current?.subscribe('/topic/scooter-locations', (message: IMessage) => {
              const locations: ScooterData[] = JSON.parse(message.body);
              setScooters(locations);
            });

            // Subscribe to scooter stats
            stompClient.current?.subscribe('/topic/scooter-stats', (message: IMessage) => {
              const statsData: ScooterStats = JSON.parse(message.body);
              setStats(statsData);
            });

            // Request initial data
            // stompClient.current?.publish({
            //   destination: '/app/location-request',
            //   body: '{}'
            // });
            // stompClient.current?.publish({
            //   destination: '/app/scooter-request',
            //   body: '{}'
            // });
          },
          onStompError: (frame) => {
            console.error('STOMP error:', frame);
            setIsConnected(false);
            setError('WebSocket STOMP error');
          },
          onWebSocketError: (error) => {
            console.error('WebSocket error:', error);
            setIsConnected(false);
            setError('WebSocket connection error');
          }
        });

        stompClient.current.activate();
      } catch (err) {
        console.error('Error creating WebSocket connection:', err);
        setError('Error creating WebSocket connection');
      }
    };

    connect();

    return () => {
      if (stompClient.current?.connected) {
        stompClient.current.deactivate();
      }
    };
  }, []);

  return { scooters, stats, isConnected, error };
};
