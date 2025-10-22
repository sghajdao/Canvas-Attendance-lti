import crypto from 'crypto';

// Generate RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to JWK
const key = crypto.createPublicKey(publicKey);
const jwk = key.export({ format: 'jwk' });
const publicJwk = {
  kty: jwk.kty,
  n: jwk.n,
  e: jwk.e,
  alg: 'RS256',
  use: 'sig',
  kid: crypto.randomBytes(16).toString('hex')
};

console.log('=== ADD THIS TO CANVAS DEVELOPER KEY ===');
console.log('Public JWK:');
console.log(JSON.stringify(publicJwk, null, 2));
console.log('\n');

console.log('=== ADD THIS TO VERCEL ENVIRONMENT VARIABLES ===');
console.log('LTI_PRIVATE_KEY:');
console.log(privateKey.replace(/\n/g, '\\n'));
console.log('\n');

console.log('Instructions:');
console.log('1. Copy the Public JWK and paste it in your Canvas Developer Key configuration');
console.log('2. Copy the LTI_PRIVATE_KEY (with \\n) and add it to Vercel environment variables');
console.log('3. Make sure to keep the private key secret!');