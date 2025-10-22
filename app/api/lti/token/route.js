import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { platform } = body;
    
    console.log('=== TOKEN EXCHANGE ===');
    console.log('Platform ISS:', platform?.iss);
    console.log('Client ID:', process.env.CANVAS_CLIENT_ID);
    console.log('Has Client Secret:', !!process.env.CANVAS_CLIENT_SECRET);
    
    // For now, skip OAuth and return failure
    // This will make the roster API use the ID token instead
    return NextResponse.json({ 
      success: false, 
      message: 'OAuth2 token exchange not yet implemented',
      reason: 'Using ID token fallback'
    });
    
  } catch (error) {
    console.error('Token route error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Token endpoint is accessible',
    method: 'Use POST to request token'
  });
}