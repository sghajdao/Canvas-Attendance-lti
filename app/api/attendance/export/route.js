import { NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db-mssql.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const course_id = searchParams.get('course_id');
  const date_from = searchParams.get('date_from');
  const date_to = searchParams.get('date_to') || new Date().toISOString().split('T')[0];

  try {
    // Simple query - no JOINs needed!
    const pool = await getPool();
    let query;
    if (date_from && date_to) {
      query = await pool.request()
      .input('courseId', sql.VarChar, course_id)
      .input('dateFrom', sql.Date, date_from)
      .input('dateTo', sql.Date, date_to)
      .query(`
        SELECT 
          course_sis_id as "SIS_Course_ID",
          student_sis_id as "SIS_Student_ID",
          status as "Attendance",
          TO_CHAR(session_date, 'YYYY-MM-DD') as "Class_Date",
          marked_by_sis_id as "SIS_Teacher_ID",
          COALESCE(course_name, course_sis_id) as "Course_Code",
          COALESCE(instructor_name, marked_by_sis_id) as "Teacher_Name"
        FROM attendance
        WHERE course_id = @courseId
          AND session_date >= @dateFrom
          AND session_date <= @dateTo
          AND student_sis_id IS NOT NULL
        ORDER BY session_date, student_sis_id
      `);
    } else {
      query = await pool.request()
      .input('courseId', sql.VarChar, course_id)
      .query(`
        SELECT 
          course_sis_id as "SIS_Course_ID",
          student_sis_id as "SIS_Student_ID",
          status as "Attendance",
          TO_CHAR(session_date, 'YYYY-MM-DD') as "Class_Date",
          marked_by_sis_id as "SIS_Teacher_ID",
          COALESCE(course_name, course_sis_id) as "Course_Code",
          COALESCE(instructor_name, marked_by_sis_id) as "Teacher_Name"
        FROM attendance
        WHERE course_id = @courseId
          AND student_sis_id IS NOT NULL
        ORDER BY session_date, student_sis_id
      `);
    }

    // Format as CSV
    const headers = ['SIS_Course_ID', 'SIS_Student_ID', 'Attendance', 'Class_Date', 'SIS_Teacher_ID', 'Course_Code', 'Teacher_Name'];
    const csvRows = [
      headers.join(','),
      ...query.map(row => 
        `${row.SIS_Course_ID},${row.SIS_Student_ID},${row.Attendance},${row.Class_Date},${row.SIS_Teacher_ID},"${row.Course_Code}","${row.Teacher_Name}"`
      )
    ];
    
    const csv = csvRows.join('\n');
    const filename = `attendance_${course_id}_${date_from || 'all'}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}