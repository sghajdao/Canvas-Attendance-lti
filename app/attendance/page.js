'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

function AttendanceContent() {
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [sessionType, setSessionType] = useState('morning');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');

  useEffect(async () => {
    const token = searchParams.get('token');
    const authorized = searchParams.get('authorized');
    
    if (authorized === 'true') {
      // Coming back from successful authorization
      const storedContext = localStorage.getItem('lti_context');
      if (storedContext) {
        const context = JSON.parse(storedContext);
        setUserInfo(context);
        if (context.isInstructor) {
          loadRoster(context);
          // loadSections(context);
        }
      }
    } else if (token) {
      try {
        const decoded = JSON.parse(decodeURIComponent(token));
        setUserInfo(decoded);
        localStorage.setItem('lti_context', JSON.stringify(decoded));
        if (decoded.isInstructor) {
          loadRoster(decoded);
          // loadSections(decoded);
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    console.log("USER INFO CHANGED:", userInfo, roster, roster.length);
    if (userInfo && roster.length > 0) {
      loadAttendance(userInfo, selectedDate, sessionType);
    }
  }, [userInfo, selectedDate, sessionType, roster.length]);
  
const loadRoster = async (userInfo) => {
  setLoading(true);
  try {
    const response = await fetch('/api/lti/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: userInfo.course_id,
        user_id: userInfo.user_id,
        user_sis_id: userInfo.user_sis_id,
        nrps_url: userInfo.nrps_url,
      }),
    });
    const data = await response.json();
    console.log('Roster data received:', data); ///////////////////////////////////////////////////////////////////////////////////////////////////////////
    setSections(data.sections || []); // Load sections if provided
    setSelectedSection(data.sections[0].name)
    
    if (data.needsAuth) {
      console.log('Authorization required');
      setRoster([]);
    } else if (data.members) {
      const students = data.members.filter(m => m.roles[0] === 'Student');
      
      // Debug: Log to see if SIS IDs are present
      console.log('Sample student data:', students[0]);
      if (students.length > 0 && !students[0].sis_user_id) {
        console.warn('WARNING: No SIS IDs found in roster data!');
      }
      
      setRoster(students);
      
      const initialAttendance = {};
      students.forEach(student => {
        initialAttendance[student.user_id] = null;
      });
      setAttendance(initialAttendance);
    }
  } catch (error) {
    console.error('Failed to load roster:', error);
    setMessage('Failed to load roster');
  } finally {
    setLoading(false);
  }
};

// const loadSections = async (userInfo) => {
//   try {
//     const response = await fetch(
//       // `https://aui.instructure.com/api/v1/courses/${userInfo.course_sis_id}/sections`,
//       `https://aui.instructure.com/api/v1/courses/5257/sections`,
//       {
//         headers: {
//           'Authorization': `Bearer ${userInfo.access_token}`, // make sure access_token exists
//         },
//       }
//     );
//     console.log("END!!!!!!!!!!!!!")

//     if (!response.ok) throw new Error('Failed to load sections');

//     // const data = await response.json();
//     const data = localStorage.getItem('sections') ? JSON.parse(localStorage.getItem('sections')) : [];
//     console.log(`Loaded ${data.length} sections from Canvas`);
//     setSections(data);
//     if (data.length > 0) {
//       setSelectedSection(data[0].name); // Default to first section
//     }
//   } catch (error) {
//     console.error('Error fetching sections:', error);
//   }
// };

const loadAttendance = async (userInfo, date, type) => {
  try {
    const response = await fetch('/api/attendance/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: userInfo.course_id,
        date: date,
        session_type: type
      }),
    });

    const data = await response.json();
    console.log('Loaded attendance records:', data);

    const records = data.records?.recordset || []; // ✅ get the array

    if (records.length > 0) {
      const attendanceMap = {};
      roster.forEach(student => {
        attendanceMap[student.user_id] = null;
      });
      records.forEach(record => {
        if (record.student_id) {
          attendanceMap[record.student_id] = record.status;
        }
      });
      setAttendance(attendanceMap);
    } else {
      const resetAttendance = {};
      roster.forEach(student => {
        resetAttendance[student.user_id] = null;
      });
      setAttendance(resetAttendance);
    }

  } catch (error) {
    console.error('Failed to load attendance:', error);
  }
};


const markAttendance = async (student, status) => {
  // Get current time
  const currentTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
  
  const previousStatus = attendance[student.user_id];
  
  // Prevent accidental changes - ask for confirmation
  if (previousStatus !== null && previousStatus !== status) {
    const statusLabels = {
      'present': '✓ Present',
      'absent': '✗ Absent', 
      'late': '⏰ Late',
      'excused': '✉ Excused'
    };
    
    const confirmed = window.confirm(
      `Change ${student.name} from "${statusLabels[previousStatus]}" to "${statusLabels[status]}"?\n\nThis change will be recorded in the audit log.`
    );
    
    if (!confirmed) {
      return; // Cancel the change
    }
  }
  
  setAttendance(prev => ({ ...prev, [student.user_id]: status }));
  setSaving(true);
  
  try {
    const response = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: userInfo.course_id,
        // course_sis_id: userInfo.course_sis_id,
        course_sis_id: selectedSection,
        student_id: student.user_id,
        student_sis_id: student.sis_user_id || null,
        status: status,
        date: selectedDate,
        session_type: sessionType,
        instructor_id: userInfo.user_id,
        instructor_sis_id: userInfo.user_sis_id,
        course_name: userInfo.course_name,
        instructor_name: userInfo.user_name,
        marked_time: currentTime,  // Add current time
        previous_status: previousStatus  // Track what it was before
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save attendance');
    }
    
    const result = await response.json();
    
    // Show different message for updates vs new marking
    if (result.wasUpdate) {
      setMessage(`✓ Updated: ${student.name} → ${status}`);
    } else {
      setMessage('✓ Saved');
    }
    
    setTimeout(() => setMessage(''), 2000);
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    setAttendance(prev => ({ ...prev, [student.user_id]: previousStatus }));
    setMessage('Failed to save');
  } finally {
    setSaving(false);
  }
};

  const markAllStatus = (status) => {
    roster.forEach(student => {
      markAttendance(student, status);
    });
  };

  const attendanceStats = () => {
    const stats = { 
      present: 0, 
      absent: 0, 
      late: 0, 
      excused: 0,
      unmarked: 0 
    };
    Object.values(attendance).forEach(status => {
      if (status === null) {
        stats.unmarked++;
      } else if (stats[status] !== undefined) {
        stats[status]++;
      }
    });
    return stats;
  };

  const formatFullDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Add the handleAuthorize function
 const handleAuthorize = () => {
  const params = new URLSearchParams({
    course_id: userInfo.course_id,
    user_id: userInfo.user_id,
    user_sis_id: userInfo.user_sis_id || '',
    course_sis_id: userInfo.course_sis_id || ''
  });
  
  const authUrl = `/api/auth/canvas?${params}`;
  const popup = window.open(
    authUrl, 
    'canvas_auth', 
    'width=600,height=700,left=200,top=100'
  );
  
  // Monitor popup and reload roster when it closes
  const checkPopup = setInterval(() => {
    try {
      if (popup && popup.closed) {
        clearInterval(checkPopup);
        console.log('Authorization popup closed, reloading roster...');
        
        // Add a small delay to ensure token is saved
        setTimeout(() => {
          setLoading(true);
          loadRoster(userInfo);
        }, 500);
      }
    } catch (e) {
      clearInterval(checkPopup);
    }
  }, 500);
};

  if (!userInfo) {
    return <div className="loading">Loading attendance system...</div>;
  }

  if (!userInfo.isInstructor) {
    return <div className="error">Access denied. Instructor access required.</div>;
  }

  if (loading) {
    return <div className="loading">Loading student roster...</div>;
  }

  const stats = attendanceStats();
  const isToday = selectedDate === today;

  return (
    <div className="attendance-page">
      <style jsx>{`
        .attendance-page {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .attendance-header {
          background: white;
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .auth-banner {
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .auth-info h3 {
          margin: 0;
          color: #2d3748;
          font-size: 18px;
        }

        .auth-info p {
          margin: 5px 0 0 0;
          color: #718096;
          font-size: 14px;
        }

        .auth-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: all 0.2s;
        }

        .auth-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .header-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-title h1 {
          font-size: 28px;
          color: #1a202c;
          margin: 0;
          font-weight: 700;
        }

        .date-display-text {
          font-size: 16px;
          color: #4a5568;
          font-weight: 500;
        }

        .today-badge {
          display: inline-block;
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .controls-row {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .date-picker-wrapper {
          position: relative;
        }

        .custom-date-picker {
          display: flex;
          align-items: center;
          background: #f7fafc;
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          transition: all 0.2s;
        }

        .custom-date-picker:hover {
          border-color: #667eea;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .date-nav-btn {
          padding: 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #4a5568;
          transition: all 0.2s;
          display: flex;
          align-items: center;
        }

        .date-nav-btn:hover {
          background: #e2e8f0;
          color: #667eea;
        }

        .date-display {
          padding: 10px 16px;
          min-width: 180px;
          text-align: center;
          font-size: 15px;
          font-weight: 600;
          color: #2d3748;
          cursor: pointer;
        }

        .session-toggle {
          display: flex;
          background: #f7fafc;
          border-radius: 12px;
          padding: 4px;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
        }

        .session-btn {
          padding: 10px 24px;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          font-weight: 600;
          color: #4a5568;
        }

        .session-btn.active {
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          color: #667eea;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
          margin-left: auto;
        }

        .action-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-success {
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
        }

        .btn-success:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
        }

        .btn-danger {
          background: linear-gradient(135deg, #fc8181, #f56565);
          color: white;
        }

        .btn-danger:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 101, 101, 0.3);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          text-align: center;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        .stat-label {
          font-size: 11px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
        }

        .stat-percentage {
          font-size: 12px;
          color: #a0aec0;
          margin-top: 4px;
        }

        .stat-present { color: #48bb78; }
        .stat-absent { color: #f56565; }
        .stat-late { color: #ed8936; }
        .stat-excused { color: #4299e1; }
        .stat-unmarked { color: #a0aec0; }

        .students-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 16px;
        }

        .student-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: all 0.2s;
        }

        .student-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.12);
        }

        .student-header {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }

        .student-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #9f7aea);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
          margin-right: 16px;
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
        }

        .student-info h3 {
          margin: 0;
          font-size: 16px;
          color: #1a202c;
          font-weight: 600;
        }

        .student-email {
          font-size: 13px;
          color: #718096;
          margin-top: 2px;
        }

        .attendance-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .att-btn {
          padding: 10px;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .att-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .att-btn.active {
          border-color: currentColor;
          color: white;
        }

        .att-btn.present.active {
          background: linear-gradient(135deg, #48bb78, #38a169);
          border-color: #48bb78;
        }

        .att-btn.absent.active {
          background: linear-gradient(135deg, #fc8181, #f56565);
          border-color: #f56565;
        }

        .att-btn.late.active {
          background: linear-gradient(135deg, #f6ad55, #ed8936);
          border-color: #ed8936;
        }

        .att-btn.excused.active {
          background: linear-gradient(135deg, #63b3ed, #4299e1);
          border-color: #4299e1;
        }

        .message {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
          padding: 14px 24px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 1000;
          animation: slideIn 0.3s ease;
          font-weight: 600;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .loading {
          text-align: center;
          padding: 50px;
          font-size: 18px;
          color: #718096;
        }

        .error {
          text-align: center;
          padding: 50px;
          font-size: 18px;
          color: #f56565;
        }
      `}</style>

      {message && <div className="message">{message}</div>}

      <div className="attendance-header">
        <div className="header-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Attendance - {userInfo.course_name}</h1>
          
          {sections.length > 0 && (
           <div style={{ position: 'relative' }}>
           <select
             value={selectedSection}
             onChange={(e) => {setSelectedSection(e.target.value);console.log("Selected section:", e.target.value);}}
             style={{
               appearance: 'none',
               padding: '10px 40px 10px 14px',
               borderRadius: '10px',
               border: '2px solid #e2e8f0',
               backgroundColor: 'white',
               fontWeight: '600',
               fontSize: '14px',
               color: '#2d3748',
               cursor: 'pointer',
               transition: 'all 0.2s ease',
               boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
               minWidth: '220px',
             }}
             onMouseEnter={(e) => {
               e.target.style.borderColor = '#cbd5e0';
               e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.07)';
             }}
             onMouseLeave={(e) => {
               e.target.style.borderColor = '#e2e8f0';
               e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
             }}
             onFocus={(e) => {
               e.target.style.borderColor = '#4299e1';
               e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
             }}
             onBlur={(e) => {
               e.target.style.borderColor = '#e2e8f0';
               e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
             }}
           >
             {sections.map((section) => (
               <option key={section.id} value={section.name}>
                 {section.name}
               </option>
             ))}
           </select>
           
           <ChevronDown
             size={18}
             style={{
               position: 'absolute',
               right: '12px',
               top: '50%',
               transform: 'translateY(-50%)',
               pointerEvents: 'none',
               color: '#718096',
             }}
           />
         </div>


          )}
        </div>
          <div className="date-display-text">
            {formatFullDate(selectedDate)}
            {isToday && <span className="today-badge">Today</span>}
          </div>
        </div>

        <div className="controls-row">
          <div className="date-picker-wrapper">
            <div className="custom-date-picker">
              <button 
                className="date-nav-btn"
                onClick={() => {
                  const prevDate = new Date(selectedDate);
                  prevDate.setDate(prevDate.getDate() - 1);
                  setSelectedDate(prevDate.toISOString().split('T')[0]);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-display"
                max={today}
                style={{ 
                  border: 'none', 
                  background: 'transparent',
                  outline: 'none'
                }}
              />
              
              <button 
                className="date-nav-btn"
                onClick={() => {
                  const nextDate = new Date(selectedDate);
                  nextDate.setDate(nextDate.getDate() + 1);
                  const next = nextDate.toISOString().split('T')[0];
                  if (next <= today) {
                    setSelectedDate(next);
                  }
                }}
                disabled={selectedDate === today}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="session-toggle">
            <button 
              className={`session-btn ${sessionType === 'morning' ? 'active' : ''}`}
              onClick={() => setSessionType('morning')}
            >
              🌅 Morning
            </button>
            <button 
              className={`session-btn ${sessionType === 'evening' ? 'active' : ''}`}
              onClick={() => setSessionType('evening')}
            >
              🌆 Evening
            </button>
          </div>

          <div className="action-buttons">
            <button 
              onClick={() => markAllStatus('present')}
              className="action-btn btn-success"
              disabled={saving}
            >
              ✓ Mark All Present
            </button>
            <button 
              onClick={() => markAllStatus('absent')}
              className="action-btn btn-danger"
              disabled={saving}
            >
              ✗ Mark All Absent
            </button>
          </div>
        </div>
      </div>

      {/* Authorization Banner - with popup */}
      {roster.length === 0 && !loading && (
        <div className="auth-banner">
          <div className="auth-info">
            <h3>Canvas API Authorization Required</h3>
            <p>⚠️ Please authorize to fetch real student data from Canvas</p>
            <p style={{ fontSize: '12px', marginTop: '5px', color: '#856404' }}>
              A popup window will open for authorization
            </p>
          </div>
          <button onClick={handleAuthorize} className="auth-btn">
            🔐 Authorize Canvas Access
          </button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Present</div>
          <div className="stat-value stat-present">{stats.present}</div>
          <div className="stat-percentage">
            {roster.length > 0 ? Math.round((stats.present / roster.length) * 100) : 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Absent</div>
          <div className="stat-value stat-absent">{stats.absent}</div>
          <div className="stat-percentage">
            {roster.length > 0 ? Math.round((stats.absent / roster.length) * 100) : 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Late</div>
          <div className="stat-value stat-late">{stats.late}</div>
          <div className="stat-percentage">
            {roster.length > 0 ? Math.round((stats.late / roster.length) * 100) : 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Excused</div>
          <div className="stat-value stat-excused">{stats.excused}</div>
          <div className="stat-percentage">
            {roster.length > 0 ? Math.round((stats.excused / roster.length) * 100) : 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unmarked</div>
          <div className="stat-value stat-unmarked">{stats.unmarked}</div>
          <div className="stat-percentage">
            {roster.length > 0 ? Math.round((stats.unmarked / roster.length) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="students-grid">
        {roster.map(student => (
          <div key={student.user_id} className="student-card">
            <div className="student-header">
              <div className="student-avatar">
                {student.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="student-info">
                <h3>{student.name}</h3>
                <div className="student-email">{student.email}</div>
              </div>
            </div>
            <div className="attendance-buttons">
              <button 
                className={`att-btn present ${attendance[student.user_id] === 'present' ? 'active' : ''}`}
                onClick={() => markAttendance(student, 'present')}
                disabled={saving}
              >
                ✓ Present
              </button>
              <button 
                className={`att-btn absent ${attendance[student.user_id] === 'absent' ? 'active' : ''}`}
                onClick={() => markAttendance(student, 'absent')}
                disabled={saving}
              >
                ✗ Absent
              </button>
              <button 
                className={`att-btn late ${attendance[student.user_id] === 'late' ? 'active' : ''}`}
                onClick={() => markAttendance(student, 'late')}
                disabled={saving}
              >
                ⏰ Late
              </button>
              <button 
                className={`att-btn excused ${attendance[student.user_id] === 'excused' ? 'active' : ''}`}
                onClick={() => markAttendance(student, 'excused')}
                disabled={saving}
              >
                ✉ Excused
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="loading">Loading attendance system...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}