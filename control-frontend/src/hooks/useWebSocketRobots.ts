import { useState, useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import type { Robot, RobotStats } from '../types/Robot';
import type { Order } from '../types/Order';

interface RobotStatsMessage {
  serving?: number;
  pickup?: number;
  returning?: number;
  waiting?: number;
  maintenance?: number;
  total?: number;
  timestamp?: string;
}

/**
 * `connecting` is only ever the state before the first successful connect.
 * Afterwards a dropped socket is `disconnected`, which STOMP resolves by itself
 * on its `reconnectDelay` — the UI only has to report it.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const ROBOT_LOCATIONS_TOPIC = '/topic/robot-locations';
const ROBOT_STATS_TOPIC = '/topic/robot-stats';
const ORDERS_TOPIC = '/topic/orders';

function normalizeRobotStats(message: RobotStatsMessage): RobotStats {
  return {
    servingCount: message.serving ?? 0,
    pickupCount: message.pickup ?? 0,
    returningCount: message.returning ?? 0,
    waitingCount: message.waiting ?? 0,
    maintenanceCount: message.maintenance ?? 0,
    totalCount: message.total ?? 0,
    timestamp: message.timestamp,
  };
}

export const useWebSocketRobots = () => {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [stats, setStats] = useState<RobotStats | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stompClient = useRef<Client | null>(null);
  // Distinguishes "has not connected yet" from "was connected and dropped", so
  // the UI can say Connecting on a fresh load instead of flashing Not connected
  // for the second it takes the socket to come up.
  const hasConnectedOnce = useRef(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'; //Default Spring Boot backend URL

  useEffect(() => {
    let active = true;

    const connect = () => {
      if (!active) return
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
            if (!active) return
            console.log('Connected to WebSocket:', frame);
            hasConnectedOnce.current = true;
            setIsConnected(true);
            setError(null);

            // Keep the subscribed topic aligned with the current backend contract.
            stompClient.current?.subscribe(ROBOT_LOCATIONS_TOPIC, (message: IMessage) => {
              const locations: Robot[] = JSON.parse(message.body);
              setRobots(locations);
            });

            // Keep the subscribed topic aligned with the current backend contract.
            stompClient.current?.subscribe(ROBOT_STATS_TOPIC, (message: IMessage) => {
              const statsData: RobotStatsMessage = JSON.parse(message.body);
              setStats(normalizeRobotStats(statsData));
            });

            // Keeps the POS order list live without a manual page refresh.
            stompClient.current?.subscribe(ORDERS_TOPIC, (message: IMessage) => {
              const incomingOrders: Order[] = JSON.parse(message.body);
              setOrders(incomingOrders);
            });
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
          },
          // A socket that closes cleanly — a backend restart, an nginx reload,
          // a sleeping laptop — raises no error at all. Without these two the
          // connection flag stays true against a dead backend and the whole
          // dashboard silently serves stale data.
          onWebSocketClose: () => {
            if (!active) return
            setIsConnected(false);
          },
          onDisconnect: () => {
            if (!active) return
            setIsConnected(false);
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
      active = false;
      if (stompClient.current?.connected) {
        stompClient.current.deactivate();
      }
    };
  }, []);

  const connectionState: ConnectionState = isConnected
    ? 'connected'
    : hasConnectedOnce.current
      ? 'disconnected'
      : 'connecting';

  return { robots, stats, orders, connectionState, error };
};
