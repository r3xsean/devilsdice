import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomService } from './room.service';
import { GameService } from './game.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [GameGateway, RoomService, GameService],
  exports: [GameGateway, RoomService, GameService],
})
export class GameModule {}
