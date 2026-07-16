import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RankingLocksService } from '../../ranking-locks/ranking-locks.service';
import { RankingAction } from '../entities/ranking-audit-log.entity';
import { RankingRepository, SectionRow } from '../ranking.repository';
import { RankedEntry } from './ranking.engine';

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
  sectionId?: string;
}

/**
 * Roll assignment engine — rankedList থেকে roll + section বসায় এবং
 * roll + history + lock + audit সব একটি DB transaction-এ commit করে (atomic)।
 */
@Injectable()
export class RollEngine {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rankingRepository: RankingRepository,
    private readonly rankingLocksService: RankingLocksService,
  ) {}

  /** roll assign + history + lock + audit — এক transaction। */
  async generateRolls(
    input: GenerateInput,
    rankedList: RankedEntry[],
    triggeredBy: string,
    action: RankingAction,
  ) {
    const sections = input.sectionId
      ? []
      : await this.rankingRepository.getSectionsForClass(input.classId);

    return this.dataSource.transaction(async (manager) => {
      await this.rankingRepository.advisoryLock(
        manager,
        input.classId,
        input.academicSessionId,
      );

      const assignments = this.assignRolls(
        rankedList,
        sections,
        input.sectionId ?? null,
      );

      const version = await this.rankingRepository.getNextVersion(
        manager,
        input.classId,
        input.academicSessionId,
      );

      const saved: RollAssignment[] = [];
      for (const a of assignments) {
        const updated = await this.rankingRepository.assignRollAndSection(
          manager,
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
        detail: {
          studentCount: saved.length,
          sectionId: input.sectionId ?? null,
        },
      });

      return {
        classId: input.classId,
        academicSessionId: input.academicSessionId,
        version,
        studentCount: saved.length,
        results: saved,
      };
    });
  }

  /**
   * rank order অনুযায়ী roll + section বসায়:
   * - নির্দিষ্ট section বা ≤১ section → roll = rank_position।
   * - একাধিক section → capacity অনুযায়ী sequential fill, প্রতি section-এ roll 1 থেকে।
   */
  private assignRolls(
    ranked: RankedEntry[],
    sections: SectionRow[],
    fixedSectionId: string | null,
  ): RollAssignment[] {
    const base = (
      r: RankedEntry,
      rollNumber: number,
      sectionId: string | null,
    ): RollAssignment => ({
      studentId: r.studentId,
      rankPosition: r.rankPosition,
      totalScore: r.totalScore,
      rollNumber,
      sectionId,
    });

    // direct — fixed section বা ০/১ section
    if (fixedSectionId || sections.length <= 1) {
      const sectionId = fixedSectionId ?? sections[0]?.id ?? null;
      return ranked.map((r) => base(r, r.rankPosition, sectionId));
    }

    // section distribution — capacity অনুযায়ী; শেষ section overflow শোষণ করে
    const assignments: RollAssignment[] = [];
    let si = 0;
    let rollInSection = 0;
    for (const r of ranked) {
      while (
        si < sections.length - 1 &&
        sections[si].max_capacity != null &&
        rollInSection >= (sections[si].max_capacity as number)
      ) {
        si += 1;
        rollInSection = 0;
      }
      rollInSection += 1;
      assignments.push(base(r, rollInSection, sections[si].id));
    }
    return assignments;
  }
}
