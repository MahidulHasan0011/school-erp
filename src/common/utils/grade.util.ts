/**
 * marks (0–100) থেকে letter grade — বাংলাদেশি GPA-5 scale।
 * exam_results.grade কলাম varchar(5), তাই শুধু letter ফেরত দেয়।
 */
export function calculateGrade(marks: number): string {
  if (marks >= 80) return 'A+';
  if (marks >= 70) return 'A';
  if (marks >= 60) return 'A-';
  if (marks >= 50) return 'B';
  if (marks >= 40) return 'C';
  if (marks >= 33) return 'D';
  return 'F';
}