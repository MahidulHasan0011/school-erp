import { Injectable } from '@nestjs/common';

/**
 * Assigns and recomputes student roll numbers within a class/section.
 * Pure domain logic — no HTTP or DB concerns; callers pass data in.
 */
@Injectable()
export class RollEngine {
  /**
   * Given students (already sorted by the desired criterion, e.g. admission date
   * or merit), returns a map of studentId -> roll number starting at 1.
   */
  assignRolls(studentIds: string[]): Map<string, number> {
    const rolls = new Map<string, number>();
    studentIds.forEach((id, index) => rolls.set(id, index + 1));
    return rolls;
  }
}
