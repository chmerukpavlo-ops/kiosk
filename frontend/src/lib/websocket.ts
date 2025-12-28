import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const apiBaseURL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : import.meta.env.DEV 
    ? 'http://localhost:3001'
    : '';

let socket: Socket | null = null;

export function connectWebSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = getToken();
  if (!token) {
    console.warn('No token available for WebSocket connection');
    return null as any;
  }

  socket = io(apiBaseURL, {
    auth: {
      token: token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  return socket;
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// Event listeners helpers
export function onStatsUpdate(callback: (data: any) => void) {
  const ws = connectWebSocket();
  if (ws) {
    ws.on('stats:update', callback);
    return () => ws.off('stats:update', callback);
  }
  return () => {};
}

export function onSaleCreated(callback: (sale: any) => void) {
  const ws = connectWebSocket();
  if (ws) {
    ws.on('sale:created', callback);
    return () => ws.off('sale:created', callback);
  }
  return () => {};
}

export function onProductUpdated(callback: (product: any) => void) {
  const ws = connectWebSocket();
  if (ws) {
    ws.on('product:updated', callback);
    return () => ws.off('product:updated', callback);
  }
  return () => {};
}

export function onStockUpdate(callback: (stock: any) => void) {
  const ws = connectWebSocket();
  if (ws) {
    ws.on('stock:update', callback);
    return () => ws.off('stock:update', callback);
  }
  return () => {};
}

