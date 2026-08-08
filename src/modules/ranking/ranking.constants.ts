import { RankedEntry } from './engine/ranking.engine';

/** দুই-ধাপের chain: ranking queue (rankedList) → roll queue (roll assign)। */
export const RANKING_QUEUE = 'ranking.jobs';
export const ROLL_QUEUE = 'roll.jobs';

export type RankingJobAction = 'GENERATE' | 'RECALCULATE';

/**
 * STEP 1 — ranking job payload (rankedList তৈরি করবে)।
 *
 * NOTE: এখানে `sectionId` নেই — ranking সবসময় পুরো class+session-এর উপর হয়।
 * section শুধু *ফলাফল* (capacity অনুযায়ী বিতরণ), ইনপুট নয়।
 */
export interface RankingJobPayload {
  action: RankingJobAction;
  classId: string;
  academicSessionId: string;
  triggeredBy: string;
}

/**
 * STEP 2-এর জন্য প্রয়োজনীয় সর্বনিম্ন তথ্য — RollEngine শুধু এই তিনটা field
 * ব্যবহার করে। পুরো RankedEntry পাঠালে message-এর আকার প্রায় দ্বিগুণ হতো
 * (এবং প্রতিটি retry-তে delay queue-তে আরেক কপি জমত)।
 */
export type RollListEntry = Pick<
  RankedEntry,
  'studentId' | 'rankPosition' | 'totalScore'
>;

/** STEP 2 — roll job payload (ranking job থেকে rankedList সহ আসে)। */
export interface RollJobPayload extends RankingJobPayload {
  rankedList: RollListEntry[];
}

export type RankingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
