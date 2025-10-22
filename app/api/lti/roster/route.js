import { NextResponse } from 'next/server';
import { getCanvasToken, refreshCanvasToken, deleteCanvasToken } from '@/lib/db-mssql';

export async function POST(request) {
  try {
    const body = await request.json();
    const { course_id, user_id, nrps_url } = body;
    
    console.log('=== ROSTER FETCH ===');
    console.log('User ID:', user_id);
    console.log('Course ID:', course_id);
    console.log('NRPS URL:', nrps_url);
    
    // Extract numeric course ID from NRPS URL if available
    let numericCourseId;
    if (nrps_url) {
      const match = nrps_url.match(/courses\/(\d+)/);
      numericCourseId = match ? match[1] : null;
      console.log('Extracted numeric course ID:', numericCourseId);
    }
    
    if (!numericCourseId && course_id) {
      numericCourseId = course_id.match(/\d+/)?.[0];
      console.log('Extracted from course_id:', numericCourseId);
    }
    
    if (!numericCourseId) {
      console.error('Could not extract Canvas course ID');
      return NextResponse.json({
        members: getMockRoster().members,
        message: 'Could not determine Canvas course ID',
        error: 'No valid course ID found'
      });
    }
    
    // Try to get stored token
    let accessToken = null;
    if (user_id && course_id) {
      console.log('Looking for stored token...');
      const tokenData = await getCanvasToken(user_id, course_id);
      if (tokenData) {
        accessToken = tokenData.accessToken;
        console.log('Found stored token for user:', user_id);
      } else {
        console.log('No stored token found, trying refresh...');
        accessToken = await refreshCanvasToken(user_id, course_id);
        if (accessToken) {
          console.log('Successfully refreshed token');
        }
      }
    } else {
      console.log('Missing user_id or course_id for token lookup');
    }
    
    if (!accessToken) {
      console.log('No valid token available, authorization required');
      return NextResponse.json({
        members: getMockRoster().members,
        message: 'API authorization required',
        needsAuth: true
      });
    }
    
    // Use Canvas API with the token
    const enrollmentsUrl = `https://aui.instructure.com/api/v1/courses/${numericCourseId}/enrollments?per_page=100&include[]=user`;
    console.log('Fetching from Canvas API:', enrollmentsUrl);

    const response = await fetch(enrollmentsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('Canvas API response status:', response.status);
//////////////////////////////////////////////////////////////////////////////////////////
    const response1 = await fetch(
      // `https://aui.instructure.com/api/v1/courses/${userInfo.course_sis_id}/sections`,
      `https://aui.instructure.com/api/v1/courses/5257/sections`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`, // make sure access_token exists
          'Accept': 'application/json'
        },
      }
    );
    console.log("END!!!!!!!!!!!!!")
    const sections = await response1.json();
    // console.log(`Loaded ${response1.status} sections from Canvas`);
    // console.log(`Loaded ${Object.keys(data.at(0))} sections from Canvas`);
    /////////////////////////////////////////////////////////////////////////////////////
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, delete it
        if (user_id && course_id) {
          await deleteCanvasToken(user_id, course_id);
        }
        return NextResponse.json({
          members: getMockRoster().members,
          message: 'API token expired - please reauthorize',
          needsAuth: true
        });
      }
      if (response.status === 404) {
        return NextResponse.json({
          members: getMockRoster().members,
          message: `Course ${numericCourseId} not found`,
          error: 'Course not found'
        });
      }
      throw new Error(`API request failed: ${response.status}`);
    }
    
const enrollments = await response.json();
console.log(`Received ${enrollments.at(0).section_integration_id} section_integration_id`);
console.log(`Received ${enrollments.at(0).course_section_id} course_section_id`);
console.log(`First Received ${Object.keys(enrollments.at(0))} enrollments from Canvas`);

// const sections = `https://aui.instructure.com/api/v1/courses/${course_id}/sections`;
// const response1 = await fetch(sections, {
//   headers: {
//     'Authorization': `Bearer ${accessToken}`,
//     'Accept': 'application/json'
//   }
// });
// console.log('Canvas API sections response status:', response1.json());

// Format the data with SIS IDs
const members = enrollments
  .filter(e => ['StudentEnrollment', 'TaEnrollment', 'TeacherEnrollment'].includes(e.type))
  .map(enrollment => ({
    user_id: enrollment.user_id?.toString(),
    sis_user_id: enrollment.user?.sis_user_id || enrollment.sis_user_id || null,  // Add this
    name: enrollment.user?.name || 'Unknown',
    email: enrollment.user?.email || enrollment.user?.login_id || '',
    roles: [
      enrollment.type === 'TeacherEnrollment' ? 'Instructor' :
      enrollment.type === 'TaEnrollment' ? 'Teaching Assistant' : 'Student'
    ],
    status: enrollment.enrollment_state === 'active' ? 'Active' : enrollment.enrollment_state,
    sortable_name: enrollment.user?.sortable_name
  }));

// Debug log to verify SIS IDs
    
    return NextResponse.json({
      members: members,
      sections: sections,
      message: `Real Canvas roster - ${members.length} members`,
      success: true
    });
    
  } catch (error) {
    console.error('Roster fetch error:', error);
    return NextResponse.json({
      members: getMockRoster().members,
      message: 'Error fetching roster',
      error: error.message
    });
  }
}

function getMockRoster() {
  return {
    members: [
      { user_id: '1001', name: 'Ahmed Hassan', email: 'ahmed.hassan@aui.ma', roles: ['Student'], status: 'Active' },
      { user_id: '1002', name: 'Fatima El Amrani', email: 'fatima.elamrani@aui.ma', roles: ['Student'], status: 'Active' },
      { user_id: '1003', name: 'Youssef Bennani', email: 'youssef.bennani@aui.ma', roles: ['Student'], status: 'Active' },
      { user_id: '1004', name: 'Sara Mokhtar', email: 'sara.mokhtar@aui.ma', roles: ['Student'], status: 'Active' },
      { user_id: '1005', name: 'Omar Tazi', email: 'omar.tazi@aui.ma', roles: ['Teaching Assistant'], status: 'Active' }
    ]
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'Roster API endpoint',
    method: 'Use POST to get roster data'
  });
}