import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const id_token = formData.get('id_token');
    const state = formData.get('state');
    
    if (!id_token) {
      throw new Error('No id_token received');
    }
    
    // Decode the JWT
    const decoded = jwt.decode(id_token);
    
    // Extract user information
const userInfo = {
  user_id: decoded?.sub || 'unknown',
  user_sis_id: decoded?.['https://purl.imsglobal.org/spec/lti/claim/custom']?.user_sis_id || 
               decoded?.['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_sourcedid || 
               null,
  user_name: decoded?.name || decoded?.['https://purl.imsglobal.org/spec/lti/claim/lis']?.person_sourcedid || 'Unknown User',
  user_email: decoded?.email || '',
  course_id: decoded?.['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '',
  course_sis_id: decoded?.['https://purl.imsglobal.org/spec/lti/claim/custom']?.course_sis_id || 
                 decoded?.['https://purl.imsglobal.org/spec/lti/claim/lis']?.course_offering_sourcedid || 
                 null,
  course_name: decoded?.['https://purl.imsglobal.org/spec/lti/claim/context']?.title || '',
  roles: decoded?.['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
  custom: decoded?.['https://purl.imsglobal.org/spec/lti/claim/custom'] || {},
};


console.log('LTI Launch - SIS IDs captured:', {
  user_sis_id: userInfo.user_sis_id,
  course_sis_id: userInfo.course_sis_id
});
    
    // Get NRPS claim for roster access
    const nrpsData = decoded?.['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];
    if (nrpsData) {
      userInfo.nrps_url = nrpsData.context_memberships_url;
      userInfo.nrps_versions = nrpsData.service_versions || ['2.0'];
    }
    
    // Get platform information for OAuth
    userInfo.platform = {
      iss: decoded?.iss,
      aud: decoded?.aud,
      deployment_id: decoded?.['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      target_link_uri: decoded?.['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'],
    };


    
    // Store the original token for API access
    userInfo.id_token = id_token;
    
    // Format roles and check if user is instructor
    let isInstructor = false;
    if (Array.isArray(userInfo.roles)) {
      isInstructor = userInfo.roles.some(role => 
        role.includes('Instructor') || 
        role.includes('Teacher') || 
        role.includes('Administrator') ||
        role.includes('ContentDeveloper') ||
        role.includes('TA')
      );
      
      userInfo.roles = userInfo.roles.map(role => {
        const parts = role.split('#');
        return parts[parts.length - 1];
      }).join(', ');
    }
    
    userInfo.isInstructor = isInstructor;
    
    // Create HTML response that redirects to dashboard with token in URL
    const encodedUserInfo = encodeURIComponent(JSON.stringify(userInfo));
    const redirectUrl = `/dashboard?token=${encodedUserInfo}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LTI Launch</title>
        <script>
          window.location.href = '${redirectUrl}';
        </script>
      </head>
      <body>
        <p>Redirecting to dashboard...</p>
      </body>
      </html>
    `;
    
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
    
  } catch (error) {
    console.error('Launch error:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Launch Error</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .error { background: #fee; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>Launch Error</h2>
          <p>${error.message}</p>
        </div>
      </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'LTI launch endpoint. POST requests only.',
    status: 'ready'
  });
}