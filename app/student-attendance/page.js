'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function StudentAttendanceContent() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      try {
        const decoded = JSON.parse(decodeURIComponent(token));
        setUserInfo(decoded);
        loadAttendance(decoded);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }, [searchParams]);

    const loadAttendance = async (userInfo) => {
    setLoading(true);
    try {
        const response = await fetch('/api/attendance/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            course_sis_id: userInfo.course_sis_id,
            student_sis_id: userInfo.user_sis_id  // Changed from user_id
        }),
        });
        const data = await response.json();
        setRecords(data.records || []);
        setStats(data.stats || {});
    } catch (error) {
        console.error('Failed to load attendance:', error);
    } finally {
        setLoading(false);
    }
    };

  const getAttendanceRate = () => {
    if (!stats || stats.total === 0) return 0;
    return Math.round(((stats.present + stats.late) / stats.total) * 100);
  };

 const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown Date';
  
  // Handle different date formats
  let date;
  if (dateStr instanceof Date) {
    date = dateStr;
  } else if (typeof dateStr === 'string') {
    // Try parsing as ISO string first
    date = new Date(dateStr);
    // If invalid, try adding T00:00:00
    if (isNaN(date.getTime())) {
      date = new Date(dateStr + 'T00:00:00');
    }
  } else {
    return 'Unknown Date';
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Unknown Date';
  }
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

  const getStatusColor = (status) => {
    const colors = {
      present: '#48bb78',
      absent: '#f56565',
      late: '#ed8936',
      excused: '#4299e1'
    };
    return colors[status] || '#a0aec0';
  };

  const getStatusIcon = (status) => {
    const icons = {
      present: '✓',
      absent: '✗',
      late: '⏰',
      excused: '✉'
    };
    return icons[status] || '?';
  };

  if (loading) {
    return <div className="loading">Loading your attendance...</div>;
  }

  const attendanceRate = getAttendanceRate();

  return (
    <div className="student-dashboard">
      <style jsx>{`
        .student-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .header {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          padding: 32px;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .header h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }

        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.9;
        }

        .stats-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          text-align: center;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }

        .stat-label {
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .stat-value {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .stat-total {
          font-size: 14px;
          color: #a0aec0;
        }

        .attendance-rate-card {
          background: white;
          padding: 28px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          margin-bottom: 24px;
          text-align: center;
        }

        .rate-circle {
          width: 160px;
          height: 160px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: conic-gradient(
            #48bb78 0deg ${attendanceRate * 3.6}deg,
            #e2e8f0 ${attendanceRate * 3.6}deg 360deg
          );
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .rate-inner {
          width: 130px;
          height: 130px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }

        .rate-percentage {
          font-size: 42px;
          font-weight: 700;
          color: #1a202c;
        }

        .rate-label {
          font-size: 14px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .records-section {
          background: white;
          padding: 28px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .records-header {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #1a202c;
        }

        .records-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .record-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
          border-left: 4px solid transparent;
          transition: all 0.2s;
        }

        .record-item:hover {
          background: #edf2f7;
          transform: translateX(4px);
        }

        .record-date {
          flex: 1;
          font-weight: 600;
          color: #2d3748;
        }

        .record-session {
          padding: 4px 12px;
          background: white;
          border-radius: 6px;
          font-size: 12px;
          color: #4a5568;
          margin-right: 12px;
        }

        .record-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #a0aec0;
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .loading {
          text-align: center;
          padding: 100px 20px;
          font-size: 18px;
          color: #718096;
        }
      `}</style>

      <div className="header">
        <h1>My Attendance</h1>
        <p>{userInfo?.course_name || 'Course'}</p>
      </div>

      {stats && stats.total > 0 ? (
        <>
          <div className="attendance-rate-card">
            <div className="rate-circle">
              <div className="rate-inner">
                <div className="rate-percentage">{attendanceRate}%</div>
                <div className="rate-label">Attendance</div>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#718096', marginTop: '8px' }}>
              You've attended {stats.present + stats.late} out of {stats.total} sessions
            </div>
          </div>

          <div className="stats-overview">
            <div className="stat-card">
              <div className="stat-label">Present</div>
              <div className="stat-value" style={{ color: '#48bb78' }}>
                {stats.present}
              </div>
              <div className="stat-total">
                {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Absent</div>
              <div className="stat-value" style={{ color: '#f56565' }}>
                {stats.absent}
              </div>
              <div className="stat-total">
                {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Late</div>
              <div className="stat-value" style={{ color: '#ed8936' }}>
                {stats.late}
              </div>
              <div className="stat-total">
                {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Excused</div>
              <div className="stat-value" style={{ color: '#4299e1' }}>
                {stats.excused}
              </div>
              <div className="stat-total">
                {stats.total > 0 ? Math.round((stats.excused / stats.total) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="records-section">
            <div className="records-header">Attendance History</div>
            <div className="records-list">
              {records.map((record, idx) => (
                <div 
                  key={idx} 
                  className="record-item"
                  style={{ borderLeftColor: getStatusColor(record.status) }}
                >
                  <div className="record-date">
                    {formatDate(record.session_date)}
                  </div>
                  <div className="record-session">
                    {record.session_type}
                  </div>
                  <div 
                    className="record-status"
                    style={{ 
                      backgroundColor: `${getStatusColor(record.status)}15`,
                      color: getStatusColor(record.status)
                    }}
                  >
                    <span>{getStatusIcon(record.status)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{record.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h2>No Attendance Records Yet</h2>
          <p>Your attendance records will appear here once your instructor starts taking attendance.</p>
        </div>
      )}
    </div>
  );
}

export default function StudentAttendance() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <StudentAttendanceContent />
    </Suspense>
  );
}