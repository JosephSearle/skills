const crypto = require('node:crypto');

const users = new Map(); // id -> { id, email, name, salt, passwordHash }

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function create({ email, name, password }) {
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id, email, name, salt, passwordHash: hash(password, salt) };
  users.set(id, user);
  return user;
}

function findById(id) {
  return users.get(id) || null;
}

function findByEmail(email) {
  for (const user of users.values()) if (user.email === email) return user;
  return null;
}

function checkPassword(user, password) {
  const candidate = Buffer.from(hash(password || '', user.salt), 'hex');
  return crypto.timingSafeEqual(candidate, Buffer.from(user.passwordHash, 'hex'));
}

module.exports = { create, findById, findByEmail, checkPassword, _users: users };
