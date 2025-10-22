import { NextResponse } from 'next/server';

export async function handleLogin(request) {
  try {
    let params = {};
    
    // Handle both GET and POST requests
    if (request.method === 'GET') {
      const { searchParams } = new URL(request.url);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } else {
      // POST request
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          params[key] = value;
        });
      } else {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          params[key] = value;
        });
      }
    }
    
    console.log('Login params received:', params);
    
    // Get Canvas parameters
    const iss = params.iss || process.env.CANVAS_PLATFORM_URL || 'https://aui.instructure.com';
    const login_hint = params.login_hint;
    const target_link_uri = params.target_link_uri;
    const lti_message_hint = params.lti_message_hint;
    const client_id = params.client_id || process.env.CANVAS_CLIENT_ID;
    const deployment_id = params.lti_deployment_id || params.deployment_id;
    
    if (!login_hint) {
      throw new Error('Missing login_hint parameter');
    }
    
    if (!target_link_uri) {
      throw new Error('Missing target_link_uri parameter');
    }
    
    // Clean up the issuer URL (remove trailing slashes)
    const cleanIss = iss.replace(/\/$/, '');
    
    // Build the authorization URL
    const authUrl = new URL(`${cleanIss}/api/lti/authorize_redirect`);
    
    // Add required parameters
    authUrl.searchParams.append('response_type', 'id_token');
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('redirect_uri', target_link_uri);
    authUrl.searchParams.append('login_hint', login_hint);
    authUrl.searchParams.append('scope', 'openid');
    authUrl.searchParams.append('response_mode', 'form_post');
    authUrl.searchParams.append('prompt', 'none');
    
    // Add state and nonce for security
    const state = Math.random().toString(36).substring(2, 15);
    const nonce = Math.random().toString(36).substring(2, 15);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('nonce', nonce);
    
    // Add message hint if provided
    if (lti_message_hint) {
      authUrl.searchParams.append('lti_message_hint', lti_message_hint);
    }
    
    // Add deployment ID if provided
    if (deployment_id) {
      authUrl.searchParams.append('lti_deployment_id', deployment_id);
    }
    
    console.log('Redirecting to:', authUrl.toString());
    
    // Redirect to Canvas authorization
    return NextResponse.redirect(authUrl.toString());
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Return an HTML error page for better debugging
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LTI Login Error</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #f5f5f5; }
          .error { background: white; padding: 20px; border-radius: 5px; border-left: 4px solid red; }
          pre { background: #f0f0f0; padding: 10px; overflow: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>LTI Login Error</h2>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>Please check your Canvas configuration and try again.</p>
          <details>
            <summary>Technical Details</summary>
            <pre>${JSON.stringify({
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString()
            }, null, 2)}</pre>
          </details>
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

export async function GET(request) {
  return handleLogin(request);
}

export async function POST(request) {
  return handleLogin(request);
}