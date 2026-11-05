const http = require('node:http');
const { requireUser, login } = require('./auth/session');
const tasks = require('./tasks/routes');

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });
}

const routes = {
  'POST /login': async (req, res) => login(req, res, await readBody(req), sendJson),
  'GET /tasks': requireUser((req, res, user) => tasks.list(req, res, user, sendJson)),
  'POST /tasks': requireUser(async (req, res, user) =>
    tasks.create(req, res, user, await readBody(req), sendJson),
  ),
};

const server = http.createServer((req, res) => {
  const handler = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!handler) return sendJson(res, 404, { error: 'not found' });
  return handler(req, res);
});

if (require.main === module) server.listen(3000);

module.exports = { server, sendJson, readBody };
