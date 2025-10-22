import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function createClientAssertion(clientId, tokenUrl, privateKey) {
  // Fix the private key format
  const formattedKey = privateKey.replace(/\\n/g, '\n');
  
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenUrl,
    iat: now,
    exp: now + 60,
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  // Sign with the same key ID we use in the JWK endpoint
  return jwt.sign(payload, formattedKey, { 
    algorithm: 'RS256',
    header: {
      kid: 'lti-key-1' // Must match the kid in the JWK endpoint
    }
  });
}