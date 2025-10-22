import Lti from 'ltijs';

let ltiProvider = null;

// Database plugin for serverless environment
class Database {
  constructor() {
    this.store = {};
  }

  async Get(key) {
    return this.store[key] || null;
  }

  async Set(key, value) {
    this.store[key] = value;
    return true;
  }

  async Delete(key) {
    delete this.store[key];
    return true;
  }
}

export async function getLtiProvider() {
  if (ltiProvider) return ltiProvider;

  try {
    const appUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.APP_URL || 'http://localhost:3000';

    // Create database instance
    const db = new Database();

    // Initialize provider without automatic deployment
    ltiProvider = new Lti(
      process.env.LTI_ENCRYPTION_KEY || 'CHANGEME12345678901234567890123456',
      {
        plugin: db
      },
      {
        appUrl: appUrl,
        loginUrl: `${appUrl}/api/lti/login`,
        sessionTimeoutUrl: `${appUrl}/api/lti/timeout`,
        invalidTokenUrl: `${appUrl}/api/lti/invalid`,
        keysetUrl: `${appUrl}/api/lti/keys`,
        devMode: false
      }
    );

    // Deploy without serverless mode
    await ltiProvider.deploy();

    // Register Canvas platform
    const platform = await ltiProvider.registerPlatform({
      url: process.env.CANVAS_PLATFORM_URL || 'https://aui.instructure.com',
      name: 'Canvas LMS',
      clientId: process.env.CANVAS_CLIENT_ID || '170000000000001',
      authenticationEndpoint: `${process.env.CANVAS_PLATFORM_URL || 'https://aui.instructure.com'}/api/lti/authorize_redirect`,
      accesstokenEndpoint: `${process.env.CANVAS_PLATFORM_URL || 'https://aui.instructure.com'}/login/oauth2/token`,
      authConfig: {
        method: 'JWK_SET',
        key: `${process.env.CANVAS_PLATFORM_URL || 'https://aui.instructure.com'}/api/lti/security/jwks`
      }
    });

    // Add deployment ID if provided
    if (process.env.CANVAS_DEPLOYMENT_ID) {
      await ltiProvider.registerPlatform({
        ...platform,
        deploymentId: process.env.CANVAS_DEPLOYMENT_ID
      });
    }

    // Set up connection callback
    ltiProvider.onConnect((token, req, res) => {
      const userInfo = {
        user_id: token.user,
        user_name: token.userInfo?.name || 'Unknown',
        user_email: token.userInfo?.email || '',
        course_id: token.context?.id || '',
        course_name: token.context?.label || token.context?.title || '',
        roles: Array.isArray(token.roles) ? token.roles.join(',') : ''
      };
      
      const redirectUrl = `${appUrl}/dashboard?token=${encodeURIComponent(JSON.stringify(userInfo))}`;
      return ltiProvider.redirect(res, redirectUrl);
    });

    return ltiProvider;
  } catch (error) {
    console.error('LTI Provider setup error:', error);
    throw error;
  }
}