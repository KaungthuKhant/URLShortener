const crypto = require('crypto');

function generateUniqueToken() {
  // Generate a random string using crypto
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}

module.exports = generateUniqueToken;
