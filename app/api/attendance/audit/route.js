import { NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db-mssql.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const course_sis_id = searchParams.get('course_sis_id');
  const date = searchParams.get('date');
  const student_sis_id = searchParams.get('student_sis_id');
  
  try {
    const pool = await getPool();
    let query;
    
    if (course_sis_id && date) {
      query = await pool.request()
      .input('courseSisId', sql.VarChar, course_sis_id)
      .input('date', sql.Date, date)
      .query(`
        SELECT 
          course_sis_id,
          student_sis_id,
          session_type,
          old_status,
          new_status,
          changed_by_sis_id,
          class_date,
          marked_time,
          changed_at,
          change_type
        FROM attendance_audit
        WHERE course_sis_id = @courseSisId
          AND class_date = @date
        ORDER BY changed_at DESC
      `);
    } else if (student_sis_id) {
      query = await pool.request()
      .input('studenSsisId', sql.VarChar, student_sis_id)
      .query(`
        SELECT 
          course_sis_id,
          student_sis_id,
          session_type,
          old_status,
          new_status,
          changed_by_sis_id,
          class_date,
          marked_time,
          changed_at,
          change_type
        FROM attendance_audit
        WHERE student_sis_id = @studenSsisId
        ORDER BY changed_at DESC
        LIMIT 50
      `);
    } else {
      return NextResponse.json({ error: 'Provide course_sis_id+date or student_sis_id' }, { status: 400 });
    }
    
    return NextResponse.json({ audit_records: query, count: query.length });
    
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}