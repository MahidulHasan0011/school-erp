import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RankingLocksService } from '../../ranking-locks/ranking-locks.service';
import { RankingAction } from '../entities/ranking-audit-log.entity';
import { RollListEntry } from '../ranking.constants';
import { RankingRepository, SectionRow } from '../ranking.repository';

export interface RollAssignment {
  studentId: string;
  rankPosition: number;
  totalScore: number;
  rollNumber: number;
  sectionId: string | null;
}

export interface GenerateInput {
  classId: string;
  academicSessionId: string;
}

export interface GenerateRollsResult {
  classId: string;
  academicSessionId: string;
  /** true হলে কিছুই লেখা হয়নি — transaction-এর ভেতরে lock পাওয়া গেছে। */
  skipped: boolean;
  version: number | null;
  studentCount: number;
  results: RollAssignment[];
}

/**
 * Roll assignment engine — rankedList থেকে roll + section বসায় এবং
 * roll + history + lock + audit সব একটি DB transaction-এ commit করে (atomic)।
 */
@Injectable()
export class RollEngine {
  private readonly logger = new Logger(RollEngine.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rankingRepository: RankingRepository,
    private readonly rankingLocksService: RankingLocksService,
  ) {}

  /** roll assign + history + lock + audit — এক transaction। */
  async generateRolls(
    input: GenerateInput,
    rankedList: RollListEntry[],
    triggeredBy: string,
    action: RankingAction,
  ): Promise<GenerateRollsResult> {
    const sections = await this.rankingRepository.getSectionsForClass(
      input.classId,
    );

    return this.dataSource.transaction(async (manager) => {
      await this.rankingRepository.advisoryLock(
        manager,
        input.classId,
        input.academicSessionId,
      );

      // advisory lock পাওয়ার *পরে* lock re-check — এটাই একমাত্র জায়গা যেখানে
      // দেখাটা সত্যিই নির্ভরযোগ্য। দুইবার generate চাপলে দুটো job একসাথে চলতে
      // পারে; দুজনেই request-time ও worker-শুরুর চেক পাশ করে যায় (তখনো কেউ
      // commit করেনি)। এখানে দ্বিতীয়জন লাইনে দাঁড়িয়ে ঢুকে দেখবে lock বসে গেছে
      // → বেরিয়ে যাবে, তাই একই ডেটার দুইটা version তৈরি হয় না।
      // RECALCULATE ইচ্ছাকৃতভাবে locked অবস্থার উপরেই চলে।
      if (action === RankingAction.GENERATE) {
        const locked = await this.rankingLocksService.isLocked(
          input.classId,
          input.academicSessionId,
          manager,
        );
        if (locked) {
          this.logger.warn(
            `Ranking already locked (${input.classId}/${input.academicSessionId}) — duplicate GENERATE বাদ দেওয়া হলো`,
          );
          return {
            classId: input.classId,
            academicSessionId: input.academicSessionId,
            skipped: true,
            version: null,
            studentCount: 0,
            results: [],
          };
        }
      }

      const assignments = this.assignRolls(rankedList, sections);

      const version = await this.rankingRepository.getNextVersion(
        manager,
        input.classId,
        input.academicSessionId,
      );

      const saved: RollAssignment[] = [];
      for (const a of assignments) {
        const updated = await this.rankingRepository.assignRollAndSection(
          manager,
          input.classId,
          input.academicSessionId,
          a.studentId,
          a.rollNumber,
          a.sectionId,
        );
        // enrollment update না হলে (যেমন withdrawn) snapshot-এ যাবে না
        if (!updated) continue;
        await this.rankingRepository.saveHistoryRow(manager, {
          academicSessionId: input.academicSessionId,
          classId: input.classId,
          studentId: a.studentId,
          totalScore: a.totalScore,
          rankPosition: a.rankPosition,
          rollNumber: a.rollNumber,
          version,
        });
        saved.push(a);
      }

      // rank generate-এর পর lock (একই transaction)
      await this.rankingLocksService.lock(
        input.classId,
        input.academicSessionId,
        triggeredBy,
        manager,
      );

      await this.rankingRepository.logAudit(manager, {
        action,
        classId: input.classId,
        academicSessionId: input.academicSessionId,
        actorId: triggeredBy,
        toVersion: version,
        detail: { studentCount: saved.length },
      });

      return {
        classId: input.classId,
        academicSessionId: input.academicSessionId,
        skipped: false,
        version,
        studentCount: saved.length,
        results: saved,
      };
    });
  }

  /**
   * rank order অনুযায়ী roll + section বসায়:
   * - ≤১ section → roll = rank_position।
   * - একাধিক section → capacity অনুযায়ী sequential fill, প্রতি section-এ roll 1 থেকে।
   */
  private assignRolls(
    ranked: RollListEntry[],
    sections: SectionRow[],
  ): RollAssignment[] {
    const base = (
      r: RollListEntry,
      rollNumber: number,
      sectionId: string | null,
    ): RollAssignment => ({
      studentId: r.studentId,
      rankPosition: r.rankPosition,
      totalScore: r.totalScore,
      rollNumber,
      sectionId,
    });

    // direct — ০ বা ১টি section হলে ক্লাসজুড়ে একটানা roll
    if (sections.length <= 1) {
      const sectionId = sections[0]?.id ?? null;
      return ranked.map((r) => base(r, r.rankPosition, sectionId));
    }

    // section distribution — capacity অনুযায়ী; শেষ section overflow শোষণ করে
    const caps = this.effectiveCapacities(sections, ranked.length);
    const assignments: RollAssignment[] = [];
    let si = 0;
    let rollInSection = 0;
    for (const r of ranked) {
      while (si < sections.length - 1 && rollInSection >= caps[si]) {
        si += 1;
        rollInSection = 0;
      }
      rollInSection += 1;
      assignments.push(base(r, rollInSection, sections[si].id));
    }
    return assignments;
  }

  /**
   * প্রতিটি section-এর ব্যবহারযোগ্য capacity।
   *
   * `max_capacity = NULL` মানে "সীমা দেওয়া হয়নি"। এটাকে অসীম ধরলে সেই section
   * তার পরের সব section-কে খালি রেখে পুরো ক্লাস শুষে নিত (আগে ঠিক তাই হতো)।
   * তাই NULL section গুলো নির্দিষ্ট capacity বাদ দিয়ে বাকি ছাত্রদের সমান ভাগ পায়।
   */
  private effectiveCapacities(
    sections: SectionRow[],
    totalStudents: number,
  ): number[] {
    const nullCount = sections.filter((s) => s.max_capacity == null).length;
    if (nullCount === 0) {
      return sections.map((s) => s.max_capacity as number);
    }
    const knownSum = sections.reduce(
      (sum, s) => sum + (s.max_capacity ?? 0),
      0,
    );
    const fairShare = Math.max(
      1,
      Math.ceil(Math.max(0, totalStudents - knownSum) / nullCount),
    );
    return sections.map((s) => s.max_capacity ?? fairShare);
  }
}
