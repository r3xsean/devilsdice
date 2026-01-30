import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@devilsdice/shared';

// Typed Socket.IO client
export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Socket.IO client singleton
class SocketService {
  private socket: TypedSocket | null = null;
  private reconnectToken: string | null = null;

  connect(): TypedSocket {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Support both VITE_WS_URL and VITE_SERVER_URL for backward compatibility
    const serverUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();

    return this.socket;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');

      // Attempt reconnection if we have a token
      if (this.reconnectToken) {
        this.socket?.emit('room:reconnect', { token: this.reconnectToken });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
  }

  getSocket(): TypedSocket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  setReconnectToken(token: string): void {
    this.reconnectToken = token;
    // Persist to localStorage for page refreshes
    localStorage.setItem('reconnectToken', token);
  }

  getReconnectToken(): string | null {
    if (!this.reconnectToken) {
      this.reconnectToken = localStorage.getItem('reconnectToken');
    }
    return this.reconnectToken;
  }

  clearReconnectToken(): void {
    this.reconnectToken = null;
    localStorage.removeItem('reconnectToken');
    localStorage.removeItem('roomCode');
  }

  setRoomCode(roomCode: string): void {
    localStorage.setItem('roomCode', roomCode);
  }

  getRoomCode(): string | null {
    return localStorage.getItem('roomCode');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Helper method to emit typed events
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (this.socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket.emit as any)(event, ...args);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Export typed socket getter for components
export const getSocket = (): TypedSocket | null => socketService.getSocket();
