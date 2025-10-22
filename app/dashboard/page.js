'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function DashboardContent() {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const token = searchParams.get('token');
      if (token) {
        const decoded = JSON.parse(decodeURIComponent(token));
        setUserInfo(decoded);
        localStorage.setItem('lti_context', JSON.stringify(decoded));
      }
    } catch (err) {
      console.error('Failed to parse user information');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!userInfo) {
    return (
      <div className="container">
        <div className="error">
          <h2>Error</h2>
          <p>Please launch from Canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Attendance System</h1>
        <p>{userInfo?.course_name || 'Course'}</p>
      </div>

      {/* Simplified Navigation */}
      {userInfo?.isInstructor && (
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            Take Attendance
          </button>
          <button 
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>
      )}

      {/* Student View */}
      {userInfo && !userInfo.isInstructor && (
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'myattendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('myattendance')}
          >
            My Attendance
          </button>
        </div>
      )}

      {/* Attendance Tab */}
      {userInfo?.isInstructor && activeTab === 'attendance' && (
        <div className="attendance-container">
          <iframe 
            src={`/attendance?token=${encodeURIComponent(JSON.stringify(userInfo))}`}
            style={{ 
              width: '100%', 
              height: '900px', 
              border: 'none',
              borderRadius: '12px'
            }}
            title="Attendance System"
          />
        </div>
      )}

      {/* Reports Tab */}
      {userInfo?.isInstructor && activeTab === 'reports' && (
        <div className="user-info-card">
          <h2>Attendance Reports</h2>
          <div className="reports-section">
            <button className="report-btn">Export Today's Attendance</button>
            <button className="report-btn">Export Weekly Report</button>
            <button className="report-btn">Export Monthly Report</button>
            <button className="report-btn">View Statistics</button>
          </div>
          <style jsx>{`
            .reports-section {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
              margin-top: 20px;
            }
            .report-btn {
              padding: 16px;
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            }
            .report-btn:hover {
              transform: translateY(-2px);
            }
          `}</style>
        </div>
      )}

      {/* Student Attendance View */}
      {userInfo && !userInfo.isInstructor && activeTab === 'myattendance' && (
        <div className="student-attendance-view">
          <iframe 
            src={`/student-attendance?token=${encodeURIComponent(JSON.stringify(userInfo))}`}
            style={{ 
              width: '100%', 
              height: '900px', 
              border: 'none',
              borderRadius: '12px'
            }}
            title="My Attendance"
          />
        </div>
      )}    
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}