//const crypto = require('crypto');
import crypto from 'crypto';

function generateUniqueToken() {
  // Generate a random string using crypto
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}

export default generateUniqueToken;
