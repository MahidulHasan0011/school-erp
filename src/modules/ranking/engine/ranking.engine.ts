import { Injectable } from '@nestjs/common';
import { RankingRepository } from '../ranking.repository';

/** ranking build-এর একটি entry (rank সহ)। */
export interface RankedEntry {
  studentId: string;
  totalScore: number;
  finalScore: number;
  midScore: number;
  admissionDate: string | null;
  enrollmentCreatedAt: string;
  rankPosition: number;
}

/**
 * Ranking domain logic — merit list (view) + new student (FIFO/admission score)
 * মিলিয়ে combined ranked list তৈরি করে। শুধু calculation, কোনো roll/lock/DB write নেই।
 */
@Injectable()
export class RankingEngine {
  constructor(private readonly rankingRepository: RankingRepository) {}

  /** Scenario অনুযায়ী combined ranked list। */
  async buildCombinedRanking(
    classId: string,
    academicSessionId: string,
    admissionTestEnabled: boolean,
  ): Promise<RankedEntry[]> {
    const merit = await this.rankingRepository.getMeritList(
      classId,
      academicSessionId,
    );
    const meritIds = merit.map((m) => m.student_id);

    const oldList: RankedEntry[] = merit.map((m) => ({
      studentId: m.student_id,
      totalScore: Number(m.total_score),
      finalScore: Number(m.final_score),
      midScore: Number(m.midterm_score),
      admissionDate: m.admission_date,
      enrollmentCreatedAt: m.enrollment_created_at,
      rankPosition: Number(m.rank_position),
    }));

    const newStudents = await this.rankingRepository.getNewStudents(
      classId,
      academicSessionId,
      meritIds,
    );

    // Scenario 1 — admission disabled: OLD merit + NEW FIFO (score 0, rank merit-এর পরে)
    if (!admissionTestEnabled) {
      const nextRank = oldList.length + 1;
      const fifo: RankedEntry[] = newStudents.map((n, i) => ({
        studentId: n.student_id,
        totalScore: 0,
        finalScore: 0,
        midScore: 0,
        admissionDate: n.admission_date,
        enrollmentCreatedAt: n.enrollment_created_at,
        rankPosition: nextRank + i,
      }));
      return [...oldList, ...fifo];
    }

    // Scenario 2 — admission enabled: OLD + NEW(admission score) merge → re-rank
    const newIds = newStudents.map((n) => n.student_id);
    const scoreRows = await this.rankingRepository.getAdmissionScores(
      classId,
      academicSessionId,
      newIds,
    );
    const scoreMap = new Map(
      scoreRows.map((r) => [r.student_id, Number(r.admission_score)]),
    );
    const newList: RankedEntry[] = newStudents.map((n) => ({
      studentId: n.student_id,
      totalScore: scoreMap.get(n.student_id) ?? 0,
      finalScore: 0,
      midScore: 0,
      admissionDate: n.admission_date,
      enrollmentCreatedAt: n.enrollment_created_at,
      rankPosition: 0,
    }));

    return this.sortAndRank([...oldList, ...newList]);
  }

  /** tie-break অনুযায়ী sort করে rank_position (1..n) বসায়। */
  private sortAndRank(list: RankedEntry[]): RankedEntry[] {
    const sorted = [...list].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.midScore !== a.midScore) return b.midScore - a.midScore;
      const ad = a.admissionDate ?? '9999-12-31';
      const bd = b.admissionDate ?? '9999-12-31';
      if (ad !== bd) return ad < bd ? -1 : 1;
      if (a.enrollmentCreatedAt !== b.enrollmentCreatedAt) {
        return a.enrollmentCreatedAt < b.enrollmentCreatedAt ? -1 : 1;
      }
      return a.studentId < b.studentId ? -1 : 1;
    });
    sorted.forEach((e, i) => (e.rankPosition = i + 1));
    return sorted;
  }
}
