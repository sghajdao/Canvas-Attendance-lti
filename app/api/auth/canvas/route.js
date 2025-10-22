import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('course_id');
  const userId = searchParams.get('user_id');
  const userSisId = searchParams.get('user_sis_id');
  const courseSisId = searchParams.get('course_sis_id');
  
  console.log('Canvas OAuth initiated with:', {
    user_id: userId,
    user_sis_id: userSisId,
    course_id: courseId,
    course_sis_id: courseSisId
  });
  
  if (!courseId || !userId) {
    console.error('Missing required parameters');
    return NextResponse.json({ error: 'Missing course_id or user_id' }, { status: 400 });
  }
  
  const stateData = {
    user_id: userId,
    user_sis_id: userSisId,
    course_id: courseId,
    course_sis_id: courseSisId
  };
  
  const params = new URLSearchParams({
    client_id: process.env.CANVAS_API_CLIENT_ID,
    response_type: 'code',
    redirect_uri: 'https://tour.aui.ma/api/auth/callback',
    state: encodeURIComponent(JSON.stringify(stateData)),
    scope: 'url:GET|/api/v1/courses/:course_id/users url:GET|/api/v1/courses/:course_id/enrollments url:GET|/api/v1/courses/:course_id/sections'
  });
  
  const authUrl = `https://aui.instructure.com/login/oauth2/auth?${params}`;
  console.log('Redirecting to Canvas OAuth');
  return NextResponse.redirect(authUrl);
}