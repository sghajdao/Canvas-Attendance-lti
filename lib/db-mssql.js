import sql from 'mssql';
import crypto from 'crypto';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

// Encryption utilities
class TokenEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 64;
    this.iterations = 100000;
  }

  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
  }

  encrypt(text) {
    const password = process.env.ENCRYPTION_KEY;
    if (!password) throw new Error('ENCRYPTION_KEY not configured');

    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    return combined.toString('base64');
  }

  decrypt(encryptedText) {
    const password = process.env.ENCRYPTION_KEY;
    if (!password) throw new Error('ENCRYPTION_KEY not configured');

    const combined = Buffer.from(encryptedText, 'base64');
    const salt = combined.slice(0, this.saltLength);
    const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
    const tag = combined.slice(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
    const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);
    
    const key = this.deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
}

const tokenEncryption = new TokenEncryption();

export async function storeCanvasToken(userId, courseId, accessToken, refreshToken = null, expiresIn = 3600) {
  const encryptedAccess = tokenEncryption.encrypt(accessToken);
  const encryptedRefresh = refreshToken ? tokenEncryption.encrypt(refreshToken) : null;
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); 
  
  const dbPool = await getPool();
  
  const result = await dbPool.request()
    .input('userId', sql.VarChar, userId)
    .input('courseId', sql.VarChar, courseId)
    .input('accessToken', sql.NVarChar(sql.MAX), encryptedAccess)
    .input('refreshToken', sql.NVarChar(sql.MAX), encryptedRefresh)
    .input('expiresAt', sql.DateTime2, expiresAt)
    .query(`
      MERGE canvas_tokens AS target
      USING (SELECT @userId AS user_id, @courseId AS course_id) AS source
      ON target.user_id = source.user_id AND target.course_id = source.course_id
      WHEN MATCHED THEN
        UPDATE SET 
          access_token = @accessToken,
          refresh_token = @refreshToken,
          expires_at = @expiresAt,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (user_id, course_id, access_token, refresh_token, expires_at)
        VALUES (@userId, @courseId, @accessToken, @refreshToken, @expiresAt);
    `);
  
  return result.rowsAffected[0];
}

export async function getCanvasToken(userId, courseId) {
  const dbPool = await getPool();
  
  const result = await dbPool.request()
    .input('userId', sql.VarChar, userId)
    .input('courseId', sql.VarChar, courseId)
    .query(`
      SELECT access_token, refresh_token, expires_at
      FROM canvas_tokens
      WHERE user_id = @userId 
      AND course_id = @courseId
      AND expires_at > GETDATE()
    `);
    console.log("USER ID:", userId, "COURSE ID:", courseId, "RESULT:", result);
  
  if (result.recordset.length === 0) {
    return null;
  }
  
  const row = result.recordset[0];
  
  return {
    accessToken: tokenEncryption.decrypt(row.access_token),
    refreshToken: row.refresh_token ? tokenEncryption.decrypt(row.refresh_token) : null,
    expiresAt: row.expires_at
  };
}

export async function deleteCanvasToken(userId, courseId) {
  const dbPool = await getPool();
  
  await dbPool.request()
    .input('userId', sql.VarChar, userId)
    .input('courseId', sql.VarChar, courseId)
    .query(`
      DELETE FROM canvas_tokens
      WHERE user_id = @userId AND course_id = @courseId
    `);
  
  return true;
}

export async function refreshCanvasToken(userId, courseId) {
  const tokenData = await getCanvasToken(userId, courseId);
  
  if (!tokenData || !tokenData.refreshToken) {
    return null;
  }
  
  const response = await fetch('https://aui.instructure.com/login/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.CANVAS_API_CLIENT_ID,
      client_secret: process.env.CANVAS_API_CLIENT_SECRET,
      refresh_token: tokenData.refreshToken
    })
  });
  
  if (!response.ok) {
    await deleteCanvasToken(userId, courseId);
    return null;
  }
  
  const newTokenData = await response.json();
  
  await storeCanvasToken(
    userId,
    courseId,
    newTokenData.access_token,
    newTokenData.refresh_token || tokenData.refreshToken,
    newTokenData.expires_in || 3600
  );
  
  return newTokenData.access_token;
}

export { sql, getPool };
