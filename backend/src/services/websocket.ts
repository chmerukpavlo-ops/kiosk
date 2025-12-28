import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../db/init.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  kioskId?: number;
}

let io: SocketIOServer | null = null;

export function initWebSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      // Get user info from database
      const userResult = await query('SELECT id, role, kiosk_id FROM users WHERE id = $1', [decoded.userId]);
      if (userResult.rows.length === 0) {
        return next(new Error('Authentication error: User not found'));
      }

      const user = userResult.rows[0];
      socket.userId = user.id;
      socket.userRole = user.role;
      socket.kioskId = user.kiosk_id;

      next();
    } catch (error: any) {
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ WebSocket client connected: ${socket.userId} (${socket.userRole})`);

    // Join room based on user role and kiosk
    if (socket.userRole === 'admin') {
      socket.join('admin');
      socket.join('all');
    } else {
      socket.join(`kiosk:${socket.kioskId}`);
      socket.join('sellers');
    }

    // Handle subscription to specific events
    socket.on('subscribe', (event: string) => {
      socket.join(event);
      console.log(`📡 Client ${socket.userId} subscribed to: ${event}`);
    });

    socket.on('unsubscribe', (event: string) => {
      socket.leave(event);
      console.log(`📡 Client ${socket.userId} unsubscribed from: ${event}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ WebSocket client disconnected: ${socket.userId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

// Broadcast events
export function broadcastStatsUpdate(data: any) {
  if (!io) return;
  io.to('admin').to('all').emit('stats:update', data);
}

export function broadcastSaleCreated(sale: any) {
  if (!io) return;
  // Broadcast to admin and specific kiosk
  io.to('admin').to('all').emit('sale:created', sale);
  if (sale.kiosk_id) {
    io.to(`kiosk:${sale.kiosk_id}`).emit('sale:created', sale);
  }
}

export function broadcastProductUpdated(product: any) {
  if (!io) return;
  io.to('admin').to('all').emit('product:updated', product);
  if (product.kiosk_id) {
    io.to(`kiosk:${product.kiosk_id}`).emit('product:updated', product);
  }
}

export function broadcastStockUpdate(stock: any) {
  if (!io) return;
  io.to('admin').to('all').emit('stock:update', stock);
  if (stock.kiosk_id) {
    io.to(`kiosk:${stock.kiosk_id}`).emit('stock:update', stock);
  }
}

