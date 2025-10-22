'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ChevronDown, 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Download, 
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  UserCheck,
  UserX,
  BarChart3,
  PieChart
} from 'lucide-react';

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
    
    // Fix: Only set selectedSection if it's not already set and sections exist
    if (data.sections && data.sections.length > 0 && !selectedSection) {
      setSelectedSection(data.sections[0].name);
    }
    
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
      setMessage(`✓ Marked: ${student.name} → ${status}`);
    }
    
    // Clear message after 3 seconds
    setTimeout(() => setMessage(''), 3000);
    
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    setMessage('❌ Failed to save attendance');
    // Reset the attendance state back to previous
    setAttendance(prev => ({ ...prev, [student.user_id]: previousStatus }));
  } finally {
    setSaving(false);
  }
};

const markAllStatus = async (status) => {
  const confirmed = window.confirm(
    `Mark ALL students as "${status}"?\n\nThis will affect ${roster.length} students and cannot be easily undone.`
  );
  
  if (!confirmed) return;

  setSaving(true);
  
  try {
    // Mark all students in parallel
    const promises = roster.map(student => {
      setAttendance(prev => ({ ...prev, [student.user_id]: status }));
      
      return fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: userInfo.course_id,
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
          marked_time: new Date().toTimeString().split(' ')[0]
        }),
      });
    });
    
    await Promise.all(promises);
    setMessage(`✓ All students marked as ${status}`);
    setTimeout(() => setMessage(''), 3000);
    
  } catch (error) {
    console.error('Failed to mark all:', error);
    setMessage('❌ Failed to mark all students');
  } finally {
    setSaving(false);
  }
};

  const handleAuthorize = () => {
    if (!userInfo) return;
    
    const authUrl = new URL('/api/lti/authorize', window.location.origin);
    authUrl.searchParams.set('course_id', userInfo.course_id);
    authUrl.searchParams.set('user_id', userInfo.user_id);
    authUrl.searchParams.set('return_url', window.location.href);
    
    // Open popup
    const popup = window.open(
      authUrl.toString(),
      'canvas_auth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );
    
    // Listen for authorization completion
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // Refresh page to get authorized data
        window.location.href = window.location.pathname + '?authorized=true';
      }
    }, 1000);
  };

  const formatFullDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isToday = selectedDate === today;

  // Calculate stats
  const stats = {
    present: Object.values(attendance).filter(status => status === 'present').length,
    absent: Object.values(attendance).filter(status => status === 'absent').length,
    late: Object.values(attendance).filter(status => status === 'late').length,
    excused: Object.values(attendance).filter(status => status === 'excused').length,
    unmarked: Object.values(attendance).filter(status => status === null).length,
  };

  const attendanceRate = roster.length > 0 ? Math.round(((stats.present + stats.late) / roster.length) * 100) : 0;

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Initializing Attendance System</h2>
          <p className="text-gray-600">Please wait while we set up your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userInfo.isInstructor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-600">This attendance system is only available to instructors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Attendance Dashboard</h1>
                <p className="text-sm text-gray-500">{userInfo.course_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userInfo.user_name}</p>
                <p className="text-xs text-gray-500">Instructor</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {userInfo.user_name?.charAt(0)?.toUpperCase() || 'I'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 ${
            message.includes('✓') 
              ? 'bg-green-50 border-green-400 text-green-800' 
              : 'bg-red-50 border-red-400 text-red-800'
          } shadow-sm`}>
            <div className="flex items-center">
              {message.includes('✓') ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 mr-2" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* Controls Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Date Selection */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date
              </label>
              <div className="relative">
                <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <button 
                    className="p-3 hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      const prevDate = new Date(selectedDate);
                      prevDate.setDate(prevDate.getDate() - 1);
                      setSelectedDate(prevDate.toISOString().split('T')[0]);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 p-3 bg-transparent border-0 text-center font-medium text-gray-900 focus:outline-none"
                    max={today}
                  />
                  
                  <button 
                    className="p-3 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-sm text-gray-600">{formatFullDate(selectedDate)}</span>
                  {isToday && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Today
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Type */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <Clock className="w-4 h-4 inline mr-2" />
                Session
              </label>
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button 
                  className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all ${
                    sessionType === 'morning' 
                      ? 'bg-white text-blue-700 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setSessionType('morning')}
                >
                  <Sun className="w-4 h-4 mr-2" />
                  Morning
                </button>
                <button 
                  className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all ${
                    sessionType === 'evening' 
                      ? 'bg-white text-indigo-700 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setSessionType('evening')}
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Evening
                </button>
              </div>
            </div>

            {/* Section Selection */}
            {sections.length > 0 && (
              <div className="lg:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  <Users className="w-4 h-4 inline mr-2" />
                  Section
                </label>
                <div className="relative">
                  <select
                    value={selectedSection}
                    onChange={(e) => {
                      setSelectedSection(e.target.value);
                      console.log("Selected section:", e.target.value);
                    }}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.name}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Quick Actions
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => markAllStatus('present')}
                  className="flex items-center justify-center px-3 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
                  disabled={saving}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  All Present
                </button>
                <button 
                  onClick={() => markAllStatus('absent')}
                  className="flex items-center justify-center px-3 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50"
                  disabled={saving}
                >
                  <UserX className="w-4 h-4 mr-1" />
                  All Absent
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Authorization Banner */}
        {roster.length === 0 && !loading && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-8 mb-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Canvas Authorization Required</h3>
            <p className="text-gray-600 mb-4">Please authorize access to fetch student data from Canvas</p>
            <button 
              onClick={handleAuthorize} 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-sm"
            >
              🔐 Authorize Canvas Access
            </button>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{roster.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present</p>
                <p className="text-3xl font-bold text-green-600">{stats.present}</p>
                <p className="text-xs text-gray-500">
                  {roster.length > 0 ? Math.round((stats.present / roster.length) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent</p>
                <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
                <p className="text-xs text-gray-500">
                  {roster.length > 0 ? Math.round((stats.absent / roster.length) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Late</p>
                <p className="text-3xl font-bold text-orange-600">{stats.late}</p>
                <p className="text-xs text-gray-500">
                  {roster.length > 0 ? Math.round((stats.late / roster.length) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Excused</p>
                <p className="text-3xl font-bold text-purple-600">{stats.excused}</p>
                <p className="text-xs text-gray-500">
                  {roster.length > 0 ? Math.round((stats.excused / roster.length) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                <p className="text-3xl font-bold text-indigo-600">{attendanceRate}%</p>
                <p className="text-xs text-gray-500">
                  Present + Late
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Student Attendance</h2>
            <div className="flex items-center space-x-3">
              {saving && (
                <div className="flex items-center text-blue-600">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                  Saving...
                </div>
              )}
              <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {roster.map(student => (
              <div key={student.user_id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                    <span className="text-white font-semibold text-lg">
                      {student.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{student.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{student.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    className={`flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-all ${
                      attendance[student.user_id] === 'present' 
                        ? 'bg-green-500 text-white shadow-sm' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-green-50 hover:border-green-200'
                    }`}
                    onClick={() => markAttendance(student, 'present')}
                    disabled={saving}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Present
                  </button>
                  
                  <button 
                    className={`flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-all ${
                      attendance[student.user_id] === 'absent' 
                        ? 'bg-red-500 text-white shadow-sm' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-red-50 hover:border-red-200'
                    }`}
                    onClick={() => markAttendance(student, 'absent')}
                    disabled={saving}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Absent
                  </button>
                  
                  <button 
                    className={`flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-all ${
                      attendance[student.user_id] === 'late' 
                        ? 'bg-orange-500 text-white shadow-sm' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-200'
                    }`}
                    onClick={() => markAttendance(student, 'late')}
                    disabled={saving}
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Late
                  </button>
                  
                  <button 
                    className={`flex items-center justify-center px-3 py-2 rounded-lg font-medium transition-all ${
                      attendance[student.user_id] === 'excused' 
                        ? 'bg-purple-500 text-white shadow-sm' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50 hover:border-purple-200'
                    }`}
                    onClick={() => markAttendance(student, 'excused')}
                    disabled={saving}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Excused
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Attendance System</h2>
          <p className="text-gray-600">Please wait while we initialize your dashboard...</p>
        </div>
      </div>
    }>
      <AttendanceContent />
    </Suspense>
  );
}