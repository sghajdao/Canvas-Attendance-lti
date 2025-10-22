import { NextResponse } from 'next/server';
import { storeCanvasToken } from '@/lib/db-mssql';

export async function GET(request) {
  console.log('=== OAUTH CALLBACK TRIGGERED ===');
  console.log('Full URL:', request.url);
  console.log('Time:', new Date().toISOString());
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    console.log('Callback params:', {
      hasCode: !!code,
      state: state?.substring(0, 50) + '...',
      error: error
    });
    
    const baseUrl = 'https://tour.aui.ma';
    
    if (error) {
      console.error('OAuth authorization error:', error);
      return new NextResponse(
        `<html>
          <body>
            <script>
              window.close();
            </script>
            <p>Authorization failed: ${error}</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    if (!code) {
      console.error('No authorization code received from Canvas');
      return new NextResponse(
        `<html>
          <body>
            <script>
              window.close();
            </script>
            <p>Authorization failed: No authorization code received</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    // Parse state data
    let stateData;
    try {
      stateData = JSON.parse(decodeURIComponent(state));
      console.log('Parsed state data:', {
        user_id: stateData.user_id,
        course_id: stateData.course_id,
        user_sis_id: stateData.user_sis_id,
        course_sis_id: stateData.course_sis_id
      });
    } catch (e) {
      console.error('Failed to parse state parameter:', e);
      stateData = { 
        course_id: state,
        user_id: null 
      };
    }
    
    // Exchange authorization code for access token
    console.log('Exchanging authorization code for access token...');
    
    const tokenEndpoint = 'https://aui.instructure.com/login/oauth2/token';
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.CANVAS_API_CLIENT_ID,
      client_secret: process.env.CANVAS_API_CLIENT_SECRET,
      code: code,
      redirect_uri: 'https://tour.aui.ma/api/auth/callback'
    });
    
    console.log('Token request params:', {
      endpoint: tokenEndpoint,
      client_id: process.env.CANVAS_API_CLIENT_ID,
      redirect_uri: 'https://tour.aui.ma/api/auth/callback'
    });
    
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        error: tokenData.error,
        description: tokenData.error_description
      });
      return new NextResponse(
        `<html>
          <body>
            <script>
              window.close();
            </script>
            <p>Token exchange failed: ${tokenData.error}</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData);
      return new NextResponse(
        `<html>
          <body>
            <script>
              window.close();
            </script>
            <p>No access token received</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    console.log('Token received successfully:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });
    
    // Store the token in database
    if (stateData.user_id && stateData.course_id) {
      try {
        await storeCanvasToken(
          stateData.user_id,
          stateData.course_id,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expires_in || 3600
        );
        console.log('Token stored successfully for user:', stateData.user_id);
        
        // Return HTML that closes popup and refreshes parent
        return new NextResponse(
          `<html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.location.reload();
                  window.close();
                } else {
                  // Fallback if not in popup
                  window.location.href = '/attendance?authorized=true';
                }
              </script>
              <p>Authorization successful! This window will close automatically.</p>
              <p>If this window doesn't close, you can <a href="#" onclick="window.close()">close it manually</a>.</p>
            </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
        
      } catch (dbError) {
        console.error('Failed to store token in database:', dbError);
        return new NextResponse(
          `<html>
            <body>
              <script>
                window.close();
              </script>
              <p>Failed to store authorization. Please try again.</p>
            </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    } else {
      console.error('Missing user_id or course_id in state:', stateData);
      return new NextResponse(
        `<html>
          <body>
            <script>
              window.close();
            </script>
            <p>Invalid authorization state. Please try again.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
  } catch (error) {
    console.error('Unexpected callback error:', error);
return new NextResponse(
  `<html>
    <body>
      <script>
        if (window.opener) {
          // Reload the entire parent window
          window.opener.location.href = window.opener.location.href;
          window.close();
        } else {
          window.location.href = '/attendance?authorized=true';
        }
      </script>
      <p>Authorization successful! This window will close automatically.</p>
    </body>
  </html>`,
  { headers: { 'Content-Type': 'text/html' } }
);
  }
}