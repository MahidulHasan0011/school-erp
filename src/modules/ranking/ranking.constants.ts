import { RankedEntry } from './engine/ranking.engine';

/** দুই-ধাপের chain: ranking queue (rankedList) → roll queue (roll assign)। */
export const RANKING_QUEUE = 'ranking.jobs';
export const ROLL_QUEUE = 'roll.jobs';

export type RankingJobAction = 'GENERATE' | 'RECALCULATE';

/** STEP 1 — ranking job payload (rankedList তৈরি করবে)। */
export interface RankingJobPayload {
  action: RankingJobAction;
  classId: string;
  academicSessionId: string;
  sectionId?: string | null;
  triggeredBy: string;
}

/** STEP 2 — roll job payload (ranking job থেকে rankedList সহ আসে)। */
export interface RollJobPayload extends RankingJobPayload {
  rankedList: RankedEntry[];
}

export type RankingJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';
