import dataSource from '../data-source';

/**
 * সব টেবিলের ডাটা মুছে ফেলে (schema/টেবিল থাকে, শুধু row মুছে যায়)।
 *
 * Usage:  npm run db:truncate
 *
 * TRUNCATE ... CASCADE ব্যবহার করায় FK dependency order নিয়ে চিন্তা করতে হয় না —
 * Postgres নিজেই নির্ভরশীল টেবিল একসাথে খালি করে। RESTART IDENTITY দিয়ে
 * sequence-ও reset হয় (আমাদের uuid PK, তবু consistency-র জন্য রাখা)।
 *
 * ⚠️ এটা DATABASE_URL-এর সব ডাটা মুছে ফেলে — শুধু dev DB-তে চালান।
 */

// migration 000-005-এ তৈরি সব টেবিল (view বাদ — ওগুলো derived, truncate করা যায় না)
const TABLES = [
  // base schema
  'role_permissions',
  'permissions',
  'roles',
  'exam_results',
  'exams',
  'student_attendance',
  'attendance_logs',
  'leaves',
  'fee_structures',
  'student_enrollments',
  'subject_assignments',
  'students',
  'teachers',
  'sections',
  'classes',
  'subjects',
  'academic_sessions',
  'users',
  // 001 roll & rank
  'ranking_history',
  'ranking_locks',
  // 003 error logs
  'error_logs',
  // 004 uploads
  'upload_audit_logs',
  'uploads',
  // 005 ranking audit
  'ranking_audit_log',
];

async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('DataSource initialized — truncating tables ...');

  const tableList = TABLES.map((t) => `public.${t}`).join(', ');

  try {
    await dataSource.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
    console.log(`✅ ${TABLES.length} tables truncated successfully.`);
  } catch (err) {
    console.error('❌ Truncate failed:', err);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

void run();
