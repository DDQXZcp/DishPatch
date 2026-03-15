import React, { createContext, useContext } from 'react';
import { useWebSocketScooters } from '../hooks/useWebSocketScooters';

const ScooterContext = createContext<ReturnType<typeof useWebSocketScooters> | null>(null);

export const ScooterWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useWebSocketScooters();
  return (
    <ScooterContext.Provider value={value}>
      {children}
    </ScooterContext.Provider>
  );
};

export const useScooterContext = () => {
  const ctx = useContext(ScooterContext);
  if (!ctx) throw new Error("useScooterContext must be used within ScooterWebSocketProvider");
  return ctx;
};