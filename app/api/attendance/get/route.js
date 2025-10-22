import { NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db-mssql.js';

export async function POST(request) {
  try {
    const pool = await getPool();
    const { course_id, date, session_type } = await request.json();
    
    const records = await pool.request()
    .input('courseId', sql.VarChar, course_id)
    .input('date', sql.Date, date)
    .input('sessionType', sql.VarChar, session_type)
    .query(`
      SELECT 
        student_id,
        student_sis_id,
        status,
        marked_time,
        marked_by_sis_id
      FROM _attendance
      WHERE course_id = @courseId
        AND session_date = @date
        AND session_type = @sessionType
    `);
    
    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error fetching _attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
