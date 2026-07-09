import { Injectable } from '@nestjs/common';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
}

/**
 * Aggregates raw attendance records into a summary + percentage.
 */
@Injectable()
export class AttendanceEngine {
  summarize(statuses: AttendanceStatus[]): AttendanceSummary {
    const summary: AttendanceSummary = {
      totalDays: statuses.length,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      percentage: 0,
    };

    for (const status of statuses) {
      summary[status] += 1;
    }

    // Late counts as present for percentage purposes
    const attended = summary.present + summary.late;
    summary.percentage = summary.totalDays
      ? Math.round((attended / summary.totalDays) * 10000) / 100
      : 0;

    return summary;
  }
}
