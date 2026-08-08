import { Injectable } from '@nestjs/common';
import { RankingRepository } from '../ranking.repository';

/**
 * ranking build-এর একটি entry (rank সহ)।
 *
 * ⚠️ date field গুলো `string | Date` — `pg` DATE/TIMESTAMP কলামকে JS `Date`
 * object-এ পরিণত করে (pg-types), কিন্তু RabbitMQ payload-এ JSON হয়ে গেলে সেগুলো
 * ISO string হয়ে ফেরে। তাই তুলনার আগে সবসময় primitive-এ নামাতে হবে (`toTime`)।
 */
export interface RankedEntry {
  studentId: string;
  totalScore: number;
  finalScore: number;
  midScore: number;
  admissionDate: string | Date | null;
  enrollmentCreatedAt: string | Date;
  rankPosition: number;
}

/** date/timestamp → তুলনাযোগ্য number। null/invalid সবার শেষে যায়। */
function toTime(value: string | Date | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
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

  /**
   * tie-break অনুযায়ী sort করে rank_position (1..n) বসায়।
   *
   * date গুলো `toTime()` দিয়ে number-এ নামানো হয় — সরাসরি `!==` দিয়ে তুলনা করলে
   * `Date` object-এর reference মেলানো হতো (একই তারিখেও সবসময় `true`), ফলে
   * comparator দুই দিকেই `1` ফেরত দিত এবং পরের tie-break গুলো (createdAt,
   * studentId) কখনো চলত না — একই দিনে ভর্তি ছাত্রদের ক্রম হয়ে যেত অনির্ধারিত।
   */
  private sortAndRank(list: RankedEntry[]): RankedEntry[] {
    const sorted = [...list].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.midScore !== a.midScore) return b.midScore - a.midScore;

      const ad = toTime(a.admissionDate);
      const bd = toTime(b.admissionDate);
      if (ad !== bd) return ad - bd; // আগে ভর্তি হলে আগে

      const ac = toTime(a.enrollmentCreatedAt);
      const bc = toTime(b.enrollmentCreatedAt);
      if (ac !== bc) return ac - bc;

      // শেষ ভরসা — deterministic, তাই একই ডেটায় প্রতিবার একই ফলাফল
      if (a.studentId === b.studentId) return 0;
      return a.studentId < b.studentId ? -1 : 1;
    });
    sorted.forEach((e, i) => (e.rankPosition = i + 1));
    return sorted;
  }
}
