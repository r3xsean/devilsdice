import { setup, assign, createActor } from 'xstate';
import { GamePhase, GameState } from '@devilsdice/shared';
import {
  GameMachineContext,
  GameMachineEvent,
  GameMachineInput,
} from './types';
import { guards } from './guards';
import {
  rollAllDice,
  rollInitialTurnOrder,
  setTurnOrder,
  processSetSelection,
  processPredictions,
  advanceTurn,
  advanceSet,
  advanceRound,
  resetPlayerRoundState,
  storePrediction,
  storeDiceSelection,
  confirmSelection,
  autoSelectDice,
  clearTurnTimer,
  autoSubmitPredictions,
} from './actions';

/**
 * XState v5 game state machine for Devil's Dice
 *
 * State flow:
 * lobby -> initial_roll (round 1 only) -> prediction -> set_selection -> set_reveal
 *   -> set_selection (if set 1) or round_summary (if set 2)
 *   -> prediction (if more rounds) or game_over (if final round)
 */
export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
    input: {} as GameMachineInput,
  },
  guards: {
    allPlayersRolled: guards.allPlayersRolled,
    allPredictionsSubmitted: guards.allPredictionsSubmitted,
    allSelectionsConfirmed: guards.allSelectionsConfirmed,
    isSet1: guards.isSet1,
    isSet2: guards.isSet2,
    hasMoreRounds: guards.hasMoreRounds,
    isGameOver: guards.isGameOver,
    isRound1: guards.isRound1,
  },
  actions: {
    // Phase transitions
    setLobbyPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.LOBBY },
    })),
    setInitialRollPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.INITIAL_ROLL },
    })),
    setPredictionPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.PREDICTION },
    })),
    setSetSelectionPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.SET_SELECTION },
    })),
    setSetRevealPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.SET_REVEAL },
    })),
    setRoundSummaryPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.ROUND_SUMMARY },
    })),
    setGameOverPhase: assign(({ context }) => ({
      gameState: { ...context.gameState, phase: GamePhase.GAME_OVER },
    })),

    // Game logic actions
    rollAllDice: assign(rollAllDice),
    rollInitialTurnOrder: assign(rollInitialTurnOrder),
    setTurnOrder: assign(setTurnOrder),
    processSetSelection: assign(processSetSelection),
    processPredictions: assign(processPredictions),
    advanceTurn: assign(advanceTurn),
    advanceSet: assign(advanceSet),
    advanceRound: assign(advanceRound),
    resetPlayerRoundState: assign(resetPlayerRoundState),
    storePrediction: assign(storePrediction),
    storeDiceSelection: assign(storeDiceSelection),
    confirmSelection: assign(confirmSelection),
    autoSelectDice: assign(autoSelectDice),
    clearTurnTimer: assign(clearTurnTimer),
    autoSubmitPredictions: assign(autoSubmitPredictions),

    // Initialize round 1
    initializeRound1: assign(({ context }) => {
      const newGameState = { ...context.gameState };
      newGameState.currentRound = 1;
      return { gameState: newGameState };
    }),

    // Clear pending selections
    clearPendingSelections: assign(({ context }) => {
      const newGameState = { ...context.gameState };
      newGameState.pendingSelections = {};
      return { gameState: newGameState };
    }),
  },
}).createMachine({
  id: 'devilsDiceGame',
  initial: 'lobby',
  context: ({ input }) => ({
    gameState: input.gameState,
    turnTimerId: null,
    turnTimeRemaining: 0,
  }),

  states: {
    /**
     * LOBBY: Waiting for players to join and ready up
     */
    lobby: {
      entry: ['setLobbyPhase'],
      on: {
        START_GAME: {
          target: 'initial_roll',
          actions: ['initializeRound1'],
        },
      },
    },

    /**
     * INITIAL_ROLL: Round 1 only - roll 2 dice per player to determine turn order
     */
    initial_roll: {
      entry: ['setInitialRollPhase', 'rollInitialTurnOrder'],
      always: {
        target: 'prediction',
        guard: 'allPlayersRolled',
        actions: ['setTurnOrder', 'rollAllDice'],
      },
    },

    /**
     * PREDICTION: All players submit predictions simultaneously
     */
    prediction: {
      entry: ['setPredictionPhase'],
      on: {
        SUBMIT_PREDICTION: {
          actions: ['storePrediction'],
        },
        PREDICTION_TIMEOUT: {
          actions: ['autoSubmitPredictions'],
        },
      },
      always: {
        target: 'set_selection',
        guard: 'allPredictionsSubmitted',
        actions: ['clearPendingSelections'],
      },
    },

    /**
     * SET_SELECTION: Turn-based dice selection (3 dice each)
     */
    set_selection: {
      entry: ['setSetSelectionPhase'],
      on: {
        SELECT_DICE: {
          actions: ['storeDiceSelection'],
        },
        CONFIRM_SELECTION: {
          actions: ['confirmSelection'],
        },
        TURN_TIMEOUT: {
          actions: ['autoSelectDice'],
        },
      },
      always: {
        target: 'set_reveal',
        guard: 'allSelectionsConfirmed',
        actions: ['processSetSelection'],
      },
    },

    /**
     * SET_REVEAL: Show results, calculate scores
     */
    set_reveal: {
      entry: ['setSetRevealPhase'],
      on: {
        NEXT_SET: [
          {
            target: 'set_selection',
            guard: 'isSet1',
            actions: ['advanceSet'],
          },
          {
            target: 'round_summary',
            guard: 'isSet2',
          },
        ],
      },
    },

    /**
     * ROUND_SUMMARY: Show round totals + prediction results
     */
    round_summary: {
      entry: ['setRoundSummaryPhase', 'processPredictions'],
      on: {
        NEXT_ROUND: [
          {
            target: 'prediction',
            guard: 'hasMoreRounds',
            actions: ['advanceRound', 'resetPlayerRoundState', 'setTurnOrder'],
          },
          {
            target: 'game_over',
            guard: 'isGameOver',
          },
        ],
        END_GAME: {
          target: 'game_over',
        },
      },
    },

    /**
     * GAME_OVER: Final standings
     */
    game_over: {
      entry: ['setGameOverPhase', 'clearTurnTimer'],
      type: 'final',
    },
  },
});

/**
 * Create a new game machine actor
 */
export function createGameActor(gameState: GameState) {
  return createActor(gameMachine, {
    input: { gameState },
  });
}

export type GameMachineActor = ReturnType<typeof createGameActor>;

/**
 * Get the current state value as a string
 */
export function getStateValue(actor: GameMachineActor): string {
  const snapshot = actor.getSnapshot();
  return snapshot.value as string;
}

/**
 * Get the current game state from the actor
 */
export function getGameStateFromActor(actor: GameMachineActor): GameState {
  const snapshot = actor.getSnapshot();
  return snapshot.context.gameState;
}
