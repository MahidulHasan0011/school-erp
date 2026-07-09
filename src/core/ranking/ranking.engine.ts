import { Injectable } from '@nestjs/common';

export interface Scored {
  studentId: string;
  total: number;
}

export interface Ranked extends Scored {
  rank: number;
}

/**
 * Computes merit ranks from total marks, handling ties with standard
 * "competition ranking" (1,2,2,4).
 */
@Injectable()
export class RankingEngine {
  rank(scores: Scored[]): Ranked[] {
    const sorted = [...scores].sort((a, b) => b.total - a.total);
    const ranked: Ranked[] = [];
    let lastTotal: number | null = null;
    let lastRank = 0;

    sorted.forEach((s, index) => {
      const rank = s.total === lastTotal ? lastRank : index + 1;
      ranked.push({ ...s, rank });
      lastTotal = s.total;
      lastRank = rank;
    });

    return ranked;
  }
}
