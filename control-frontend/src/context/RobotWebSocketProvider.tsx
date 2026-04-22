import React, { createContext, useContext } from 'react';
import { useWebSocketRobots } from '../hooks/useWebSocketRobots';

const RobotContext = createContext<ReturnType<typeof useWebSocketRobots> | null>(null);

export const RobotWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useWebSocketRobots();
  return (
    <RobotContext.Provider value={value}>
      {children}
    </RobotContext.Provider>
  );
};

export const useRobotContext = () => {
  const ctx = useContext(RobotContext);
  if (!ctx) throw new Error("useRobotContext must be used within RobotWebSocketProvider");
  return ctx;
};
