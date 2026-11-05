const crypto = require('node:crypto');
const users = require('../users/store');

const sessions = new Map(); // sid -> userId

function parseSid(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? match[1] : null;
}

function login(req, res, body, sendJson) {
  const user = users.findByEmail(body.email);
  if (!user || !users.checkPassword(user, body.password)) {
    return sendJson(res, 401, { error: 'invalid credentials' });
  }
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, user.id);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Strict`);
  return sendJson(res, 200, { id: user.id, name: user.name });
}

function requireUser(handler) {
  return (req, res) => {
    const userId = sessions.get(parseSid(req));
    const user = userId && users.findById(userId);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthenticated' }));
    }
    return handler(req, res, user);
  };
}

function destroySession(req) {
  sessions.delete(parseSid(req));
}

module.exports = { login, requireUser, destroySession, sessions };
