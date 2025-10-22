import { NextResponse } from 'next/server';
import { sql, getPool } from '@/lib/db-mssql.js';

export async function POST(request) {
  try {
    const pool = await getPool();
    const { 
      course_id, course_sis_id, student_id, student_sis_id,
      status, date, session_type, instructor_id,
      instructor_sis_id, course_name, instructor_name,
      marked_time // <-- make sure frontend sends this as "HH:mm:ss"
    } = await request.json();

    // Parse marked_time "HH:mm:ss" into a Date
    const [h, m, s] = marked_time.split(':').map(Number);
    const now = new Date();
    const markedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);

    console.log('Marking attendance at:', markedDate);

    // Check existing attendance
    const existing = await pool.request()
      .input('courseId', sql.VarChar, course_id)
      .input('date', sql.Date, date)
      .input('sessionType', sql.VarChar, session_type)
      .input('studentId', sql.VarChar, student_id)
      .query(`
        SELECT id, status FROM _attendance
        WHERE course_id = @courseId
          AND session_date = @date
          AND session_type = @sessionType
          AND student_id = @studentId
      `);

    const isUpdate = existing.recordset.length > 0;
    const oldStatus = isUpdate ? existing.recordset[0].status : null;

    // Insert/update _attendance with MERGE
    const result = await pool.request()
      .input('courseId', sql.VarChar, course_id)
      .input('courseSisId', sql.VarChar, course_sis_id)
      .input('courseName', sql.VarChar, course_name)
      .input('date', sql.Date, date)
      .input('sessionType', sql.VarChar, session_type)
      .input('studentId', sql.VarChar, student_id)
      .input('studentSisId', sql.VarChar, student_sis_id)
      .input('status', sql.VarChar, status)
      .input('markedTime', sql.Time, markedDate)
      .input('instructorId', sql.VarChar, instructor_id)
      .input('instructorSisId', sql.VarChar, instructor_sis_id)
      .input('instructorName', sql.VarChar, instructor_name)
      .query(`
        MERGE _attendance AS target
        USING (SELECT @courseId AS course_id, @date AS session_date, 
                      @sessionType AS session_type, @studentId AS student_id) AS source
        ON target.course_id = source.course_id 
           AND target.session_date = source.session_date
           AND target.session_type = source.session_type
           AND target.student_id = source.student_id
        WHEN MATCHED THEN
          UPDATE SET 
            status = @status,
            marked_time = @markedTime,
            marked_at = GETDATE(),
            marked_by = @instructorId,
            marked_by_sis_id = @instructorSisId
        WHEN NOT MATCHED THEN
          INSERT (course_id, course_sis_id, course_name, session_date, session_type,
                  student_id, student_sis_id, status, marked_time, marked_by, 
                  marked_by_sis_id, instructor_name)
          VALUES (@courseId, @courseSisId, @courseName, @date, @sessionType,
                  @studentId, @studentSisId, @status, @markedTime, @instructorId,
                  @instructorSisId, @instructorName)
        OUTPUT INSERTED.id;
      `);

    const attendanceId = result.recordset[0].id;

    // Insert into audit
    await pool.request()
      .input('sessionId', sql.Int, attendanceId)
      .input('studentId', sql.VarChar, student_id)
      .input('studentSisId', sql.VarChar, student_sis_id)
      .input('courseSisId', sql.VarChar, course_sis_id)
      .input('sessionType', sql.VarChar, session_type)
      .input('oldStatus', sql.VarChar, oldStatus)
      .input('newStatus', sql.VarChar, status)
      .input('changedBy', sql.VarChar, instructor_id)
      .input('changedBySisId', sql.VarChar, instructor_sis_id)
      .input('classDate', sql.Date, date)
      .input('markedTime', sql.Time, markedDate)
      .input('changeType', sql.VarChar, isUpdate ? 'update' : 'initial')
      .query(`
        INSERT INTO attendance_audit (
          session_id, student_id, course_sis_id, student_sis_id, session_type,
          old_status, new_status, changed_by, changed_by_sis_id,
          class_date, marked_time, change_type
        )
        VALUES (
          @sessionId, @studentId, @courseSisId, @studentSisId, @sessionType,
          @oldStatus, @newStatus, @changedBy, @changedBySisId,
          @classDate, @markedTime, @changeType
        )
      `);

    return NextResponse.json({ success: true, wasUpdate: isUpdate });

  } catch (error) {
    console.error('Error marking attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
