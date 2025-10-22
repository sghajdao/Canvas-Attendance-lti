// import { neon } from '@neondatabase/serverless';
// import crypto from 'crypto';

// // Initialize Neon connection
// const sql = neon(process.env.DATABASE_URL);

// // Encryption utilities
// class TokenEncryption {
//   constructor() {
//     this.algorithm = 'aes-256-gcm';
//     this.keyLength = 32;
//     this.ivLength = 16;
//     this.tagLength = 16;
//     this.saltLength = 64;
//     this.iterations = 100000;
//   }

//   deriveKey(password, salt) {
//     return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
//   }

//   encrypt(text) {
//     const password = process.env.ENCRYPTION_KEY;
//     if (!password) throw new Error('ENCRYPTION_KEY not configured');

//     const salt = crypto.randomBytes(this.saltLength);
//     const key = this.deriveKey(password, salt);
//     const iv = crypto.randomBytes(this.ivLength);
//     const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
//     const encrypted = Buffer.concat([
//       cipher.update(text, 'utf8'),
//       cipher.final()
//     ]);
    
//     const tag = cipher.getAuthTag();
//     const combined = Buffer.concat([salt, iv, tag, encrypted]);
//     return combined.toString('base64');
//   }

//   decrypt(encryptedText) {
//     const password = process.env.ENCRYPTION_KEY;
//     if (!password) throw new Error('ENCRYPTION_KEY not configured');

//     const combined = Buffer.from(encryptedText, 'base64');
//     const salt = combined.slice(0, this.saltLength);
//     const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
//     const tag = combined.slice(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
//     const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);
    
//     const key = this.deriveKey(password, salt);
//     const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
//     decipher.setAuthTag(tag);
    
//     const decrypted = Buffer.concat([
//       decipher.update(encrypted),
//       decipher.final()
//     ]);
    
//     return decrypted.toString('utf8');
//   }
// }

// const tokenEncryption = new TokenEncryption();

// export async function initDatabase() {
//   try {
//     await sql(`
//       CREATE TABLE IF NOT EXISTS platforms (
//         id SERIAL PRIMARY KEY,
//         platform_id VARCHAR(255) UNIQUE,
//         client_id VARCHAR(255),
//         auth_endpoint VARCHAR(255),
//         token_endpoint VARCHAR(255),
//         jwks_endpoint VARCHAR(255),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await sql(`
//       CREATE TABLE IF NOT EXISTS user_launches (
//         id SERIAL PRIMARY KEY,
//         user_id VARCHAR(255),
//         user_name VARCHAR(255),
//         user_email VARCHAR(255),
//         course_id VARCHAR(255),
//         course_name VARCHAR(255),
//         roles TEXT,
//         resource_link_id VARCHAR(255),
//         custom_params JSONB,
//         launch_data JSONB,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await sql(`
//       CREATE TABLE IF NOT EXISTS lti_storage (
//         key VARCHAR(255) PRIMARY KEY,
//         value TEXT,
//         expires_at TIMESTAMP
//       )
//     `);

//     await sql(`
//       CREATE TABLE IF NOT EXISTS canvas_tokens (
//         id SERIAL PRIMARY KEY,
//         user_id VARCHAR(255) NOT NULL,
//         course_id VARCHAR(255) NOT NULL,
//         access_token TEXT NOT NULL,
//         refresh_token TEXT,
//         expires_at TIMESTAMP NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         UNIQUE(user_id, course_id)
//       )
//     `);

//     await sql(`
//       CREATE INDEX IF NOT EXISTS idx_canvas_tokens_user_course 
//       ON canvas_tokens(user_id, course_id)
//     `);

//     await sql(`
//       CREATE INDEX IF NOT EXISTS idx_canvas_tokens_expires 
//       ON canvas_tokens(expires_at)
//     `);

//     await sql(`
//       CREATE TABLE _attendance (
//       id INT IDENTITY(1,1) PRIMARY KEY,
//       course_id VARCHAR(255) NOT NULL,
//       course_sis_id VARCHAR(255),
//       course_name VARCHAR(255),
//       session_date DATE NOT NULL,
//       session_type VARCHAR(20) DEFAULT 'morning',
//       student_id VARCHAR(255) NOT NULL,
//       student_sis_id VARCHAR(255),
//       status VARCHAR(20) NOT NULL,
//       marked_time TIME,
//       marked_by VARCHAR(255) NOT NULL,
//       marked_by_sis_id VARCHAR(255),
//       instructor_name VARCHAR(255),
//       marked_at DATETIME2 DEFAULT GETDATE(),
//       CONSTRAINT UQ_attendance_record UNIQUE (course_id, session_date, session_type, student_id),
//       CONSTRAINT CHK_status CHECK (status IN ('present', 'absent', 'late', 'excused'))
//     `);

//     await sql(`
//       CREATE INDEX idx_attendance_course_date ON _attendance(course_id, session_date)
//     `);

//     await sql(`
//       CREATE INDEX idx_attendance_student ON _attendance(student_id)
//     `);

//     await sql(`
//       CREATE INDEX idx_attendance_sis ON _attendance(course_sis_id, student_sis_id)
//     `);

//     await sql(`
//       CREATE TABLE attendance_audit (
//       id INT IDENTITY(1,1) PRIMARY KEY,
//       session_id INT NOT NULL,
//       student_id VARCHAR(255) NOT NULL,
//       student_sis_id VARCHAR(255),
//       old_status VARCHAR(20),
//       new_status VARCHAR(20) NOT NULL,
//       changed_by VARCHAR(255) NOT NULL,
//       changed_by_sis_id VARCHAR(255),
//       changed_at DATETIME2 DEFAULT GETDATE(),
//       class_date DATE,
//       marked_time TIME,
//       change_type VARCHAR(20),
//       course_sis_id VARCHAR(255),
//       session_type VARCHAR(20),
//       CONSTRAINT FK_attendance FOREIGN KEY (session_id) REFERENCES _attendance(id) ON DELETE CASCADE)
//     `);

//     await sql(`
//       CREATE INDEX idx_audit_session ON attendance_audit(session_id);
//     `);

//     await sql(`
//       CREATE INDEX idx_audit_student ON attendance_audit(student_sis_id);
//     `);

//     await sql(`
//       CREATE INDEX idx_audit_date ON attendance_audit(class_date);
//     `);

//     console.log('Database initialized successfully');
//   } catch (error) {
//     console.error('Database initialization error:', error);
//   }
// }

// export async function saveUserLaunch(launchData) {
//   try {
//     const result = await sql(
//       `INSERT INTO user_launches (
//         user_id, user_name, user_email, course_id, course_name, 
//         roles, resource_link_id, launch_data
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//       RETURNING *`,
//       [
//         launchData.user_id,
//         launchData.user_name,
//         launchData.user_email,
//         launchData.course_id,
//         launchData.course_name,
//         launchData.roles,
//         launchData.resource_link_id,
//         JSON.stringify(launchData)
//       ]
//     );
//     return result[0];
//   } catch (error) {
//     console.error('Error saving launch data:', error);
//     throw error;
//   }
// }

// export async function getUserLaunches(userId) {
//   try {
//     const result = await sql(
//       `SELECT * FROM user_launches 
//        WHERE user_id = $1 
//        ORDER BY created_at DESC 
//        LIMIT 10`,
//       [userId]
//     );
//     return result;
//   } catch (error) {
//     console.error('Error fetching user launches:', error);
//     throw error;
//   }
// }

// export async function storeCanvasToken(userId, courseId, accessToken, refreshToken = null, expiresIn = 3600) {
//   try {
//     const encryptedAccess = tokenEncryption.encrypt(accessToken);
//     const encryptedRefresh = refreshToken ? tokenEncryption.encrypt(refreshToken) : null;
    
//     // Use the actual expiry from Canvas (usually 3600 seconds = 1 hour)
//     const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    
//     const result = await sql`
//       INSERT INTO canvas_tokens (user_id, course_id, access_token, refresh_token, expires_at)
//       VALUES (${userId}, ${courseId}, ${encryptedAccess}, ${encryptedRefresh}, ${expiresAt})
//       ON CONFLICT (user_id, course_id)
//       DO UPDATE SET 
//         access_token = ${encryptedAccess},
//         refresh_token = ${encryptedRefresh},
//         expires_at = ${expiresAt},
//         updated_at = CURRENT_TIMESTAMP
//       RETURNING id
//     `;
    
//     console.log('Token stored until:', expiresAt);
//     return result[0].id;
//   } catch (error) {
//     console.error('Error storing token:', error);
//     throw error;
//   }
// }

// export async function getCanvasToken(userId, courseId) {
//   try {
//     const result = await sql`
//       SELECT access_token, refresh_token, expires_at
//       FROM canvas_tokens
//       WHERE user_id = ${userId} 
//       AND course_id = ${courseId}
//       AND expires_at > CURRENT_TIMESTAMP
//     `;
    
//     if (result.length === 0) {
//       return null;
//     }
    
//     const row = result[0];
    
//     return {
//       accessToken: tokenEncryption.decrypt(row.access_token),
//       refreshToken: row.refresh_token ? tokenEncryption.decrypt(row.refresh_token) : null,
//       expiresAt: row.expires_at
//     };
//   } catch (error) {
//     console.error('Error retrieving token:', error);
//     return null;
//   }
// }

// export async function deleteCanvasToken(userId, courseId) {
//   try {
//     const result = await sql`
//       DELETE FROM canvas_tokens
//       WHERE user_id = ${userId} AND course_id = ${courseId}
//     `;
//     return true;
//   } catch (error) {
//     console.error('Error deleting token:', error);
//     return false;
//   }
// }

// export async function refreshCanvasToken(userId, courseId) {
//   try {
//     const tokenData = await getCanvasToken(userId, courseId);
    
//     if (!tokenData || !tokenData.refreshToken) {
//       return null;
//     }
    
//     const response = await fetch('https://aui.instructure.com/login/oauth2/token', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: new URLSearchParams({
//         grant_type: 'refresh_token',
//         client_id: process.env.CANVAS_API_CLIENT_ID,
//         client_secret: process.env.CANVAS_API_CLIENT_SECRET,
//         refresh_token: tokenData.refreshToken
//       })
//     });
    
//     if (!response.ok) {
//       await deleteCanvasToken(userId, courseId);
//       return null;
//     }
    
//     const newTokenData = await response.json();
    
//     await storeCanvasToken(
//       userId,
//       courseId,
//       newTokenData.access_token,
//       newTokenData.refresh_token || tokenData.refreshToken,
//       newTokenData.expires_in || 3600
//     );
    
//     return newTokenData.access_token;
//   } catch (error) {
//     console.error('Error refreshing token:', error);
//     return null;
//   }
// }

// export async function cleanupExpiredTokens() {
//   try {
//     await sql(`DELETE FROM canvas_tokens WHERE expires_at < CURRENT_TIMESTAMP`);
//     console.log('Expired tokens cleaned up');
//     return true;
//   } catch (error) {
//     console.error('Error cleaning up tokens:', error);
//     return false;
//   }
// }