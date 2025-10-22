import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  try {
    // Get the private key from environment
    const privateKeyPem = process.env.LTI_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKeyPem) {
      // Return a placeholder JWK if no key is configured
      return NextResponse.json({
        keys: [{
          kty: 'RSA',
          alg: 'RS256',
          use: 'sig',
          kid: 'lti-key-1',
          n: 'placeholder',
          e: 'AQAB'
        }]
      });
    }
    
    // Generate JWK from the private key
    const publicKey = crypto.createPublicKey({
      key: privateKeyPem,
      format: 'pem'
    });
    
    const jwk = publicKey.export({ format: 'jwk' });
    
    return NextResponse.json({
      keys: [{
        kty: jwk.kty,
        alg: 'RS256',
        use: 'sig',
        kid: 'lti-key-1', // Fixed key ID
        n: jwk.n,
        e: jwk.e
      }]
    });
    
  } catch (error) {
    console.error('JWK generation error:', error);
    return NextResponse.json({
      keys: [{
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: 'error',
        n: 'error',
        e: 'AQAB'
      }]
    });
  }
}