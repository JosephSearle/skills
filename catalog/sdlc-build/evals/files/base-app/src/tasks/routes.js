const store = require('./store');
const audit = require('../audit/log');

function list(req, res, user, sendJson) {
  return sendJson(res, 200, store.listByUser(user.id));
}

function create(req, res, user, body, sendJson) {
  if (!body.title) return sendJson(res, 400, { error: 'title is required' });
  const task = store.create(user.id, body);
  audit.record({ userId: user.id, email: user.email, action: 'task.create', taskId: task.id });
  return sendJson(res, 201, task);
}

module.exports = { list, create };
