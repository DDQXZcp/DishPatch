# WebSocket Integration Guide: Real-Time Scooter Updates

This guide explains how to set up and use real-time WebSocket data using a wrapper hook and React context.

---

## 1. File Overview

| File                          | Description                                                |
|------------------------------|------------------------------------------------------------|
| useWebSocketScooters.ts      | Hook for connecting to WebSocket and managing scooter data |
| ScooterWebSocketProvider.tsx | Context provider for sharing WebSocket data via React      |
| Any Component (e.g. Map)     | Consumes WebSocket data via the context                    |

---

## 2. useWebSocketScooters.ts

This hook handles:
- Connecting to backend WebSocket via SockJS and STOMP
- Listening to updates
- Exposing: scooters, stats, connection state, and error

Example:

```ts
const { scooters, stats, isConnected, error } = useWebSocketScooters();
```

---

## 3. ScooterWebSocketProvider.tsx

This file:
- Creates and provides context using the WebSocket hook
- Exposes a custom hook to safely access context values

```tsx
import React, { createContext, useContext } from 'react';
import { useWebSocketScooters } from '../hooks/useWebSocketScooters';

const ScooterContext = createContext(null);

export const ScooterWebSocketProvider = ({ children }) => {
  const value = useWebSocketScooters();
  return (
    <ScooterContext.Provider value={value}>
      {children}
    </ScooterContext.Provider>
  );
};

export const useScooterContext = () => {
  const ctx = useContext(ScooterContext);
  if (!ctx) throw new Error('useScooterContext must be used within ScooterWebSocketProvider');
  return ctx;
};
```

---

## 4. Wrapping the App

In App.tsx, wrap your component tree with the provider:

```tsx
import { ScooterWebSocketProvider } from './context/ScooterWebSocketProvider';

function App() {
  return (
    <ScooterWebSocketProvider>
      <Router>
        {/* your routes here */}
      </Router>
    </ScooterWebSocketProvider>
  );
}
```

---

## 5. Consuming the Context

Inside any component (e.g. ANUCampusMap.tsx), you can do:

```tsx
import { useScooterContext } from '../context/ScooterWebSocketProvider';

export default function ANUCampusMap() {
  const { scooters, isConnected, stats } = useScooterContext();

  return (
    <div>
      <p>{isConnected ? 'Connected' : 'Disconnected'}</p>
      {scooters.map((scooter) => (
        <div key={scooter.id}>
          {scooter.name} - {scooter.status}
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Common Issues

- "global is not defined" error:
  - Add `define: { global: 'globalThis' }` in `vite.config.ts`
- SockJS URL must be HTTP:
  - Use `http://your-backend/ws` (not `ws://`)
- Ensure `useScooterContext` is used inside the provider
- Make sure backend supports SockJS + STOMP

---

## 7. Vite Config Fix (vite.config.ts)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['buffer', 'process']
  }
});
```

---

## 8. Debugging Tips

- Check WebSocket connection status using `isConnected`
- Log incoming scooter updates in the hook:
  ```ts
  useEffect(() => {
    console.log("Received scooters:", scooters);
  }, [scooters]);
  ```

---

## Summary

- Setup the provider in your root
- Use the `useScooterContext` hook
- Display and manage live scooter data
- Configure Vite to support WebSocket client dependencies