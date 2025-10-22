import { NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db-mssql.js';

export async function POST(request) {
  try {
    const pool = await getPool();
    const { course_sis_id, student_sis_id } = await request.json();
    
    console.log('Fetching for:', { course_sis_id, student_sis_id });
    
    // Query by SIS IDs
    const result = await pool.request()
      .input('courseSisId', sql.VarChar, course_sis_id)
      .input('studentSisId', sql.VarChar, student_sis_id)
      .query(`
        SELECT 
          session_date,
          session_type,
          status,
          marked_time,
          marked_at
        FROM _attendance
        WHERE course_sis_id = @courseSisId
          AND student_sis_id = @studentSisId
        ORDER BY session_date DESC, session_type
      `);

    const records = result.recordset || [];
    console.log('Found records:', records.length);
    
    const stats = {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      excused: records.filter(r => r.status === 'excused').length
    };
    
    return NextResponse.json({ records, stats });
  } catch (error) {
    console.error('Error fetching student _attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
