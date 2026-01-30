import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { GameState, ReconnectToken } from '@devilsdice/shared';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);

  // In-memory fallback for development
  private inMemoryStore = new Map<string, string>();
  private useInMemory = true;

  async onModuleInit(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(
              'Redis connection failed, falling back to in-memory store',
            );
            this.useInMemory = true;
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}. Using in-memory store.`);
        this.useInMemory = true;
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.useInMemory = false;
      });

      // Attempt to connect
      await this.client.connect().catch(() => {
        this.logger.warn('Could not connect to Redis, using in-memory store');
        this.useInMemory = true;
      });
    } catch (error) {
      this.logger.warn('Redis initialization failed, using in-memory store');
      this.useInMemory = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  // Game State operations
  async getGameState(roomCode: string): Promise<GameState | null> {
    const key = `game:${roomCode}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setGameState(roomCode: string, state: GameState): Promise<void> {
    const key = `game:${roomCode}`;
    // Expire game state after 24 hours
    await this.set(key, JSON.stringify(state), 86400);
  }

  async deleteGameState(roomCode: string): Promise<void> {
    const key = `game:${roomCode}`;
    await this.del(key);
  }

  // Reconnect Token operations
  async getReconnectToken(token: string): Promise<ReconnectToken | null> {
    const key = `reconnect:${token}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setReconnectToken(token: string, data: ReconnectToken): Promise<void> {
    const key = `reconnect:${token}`;
    // Expire token after 24 hours
    await this.set(key, JSON.stringify(data), 86400);
  }

  async deleteReconnectToken(token: string): Promise<void> {
    const key = `reconnect:${token}`;
    await this.del(key);
  }

  // Generic Redis operations with fallback
  private async get(key: string): Promise<string | null> {
    if (this.useInMemory) {
      return this.inMemoryStore.get(key) || null;
    }
    return this.client?.get(key) || null;
  }

  private async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryStore.set(key, value);
      if (ttlSeconds) {
        setTimeout(() => this.inMemoryStore.delete(key), ttlSeconds * 1000);
      }
      return;
    }
    if (ttlSeconds) {
      await this.client?.setex(key, ttlSeconds, value);
    } else {
      await this.client?.set(key, value);
    }
  }

  private async del(key: string): Promise<void> {
    if (this.useInMemory) {
      this.inMemoryStore.delete(key);
      return;
    }
    await this.client?.del(key);
  }

  // Utility method to check connection status
  isConnected(): boolean {
    return !this.useInMemory && this.client?.status === 'ready';
  }
}
