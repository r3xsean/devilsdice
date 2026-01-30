import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GAME_LIMITS } from '@devilsdice/shared';

export class GameConfigDto {
  @IsOptional()
  @IsInt()
  @Min(GAME_LIMITS.MIN_ROUNDS)
  @Max(GAME_LIMITS.MAX_ROUNDS)
  totalRounds?: number;

  @IsOptional()
  @IsInt()
  @Min(GAME_LIMITS.MIN_TIMER)
  @Max(GAME_LIMITS.MAX_TIMER)
  turnTimerSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(GAME_LIMITS.MIN_PLAYERS)
  @Max(GAME_LIMITS.MAX_PLAYERS)
  maxPlayers?: number;
}

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  playerName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GameConfigDto)
  config?: GameConfigDto;
}

export class JoinRoomDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Room code must be 6 uppercase alphanumeric characters',
  })
  roomCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  playerName: string;
}

export class UpdateConfigDto {
  @IsOptional()
  @IsInt()
  @Min(GAME_LIMITS.MIN_ROUNDS)
  @Max(GAME_LIMITS.MAX_ROUNDS)
  totalRounds?: number;

  @IsOptional()
  @IsInt()
  @Min(GAME_LIMITS.MIN_TIMER)
  @Max(GAME_LIMITS.MAX_TIMER)
  turnTimerSeconds?: number;
}
