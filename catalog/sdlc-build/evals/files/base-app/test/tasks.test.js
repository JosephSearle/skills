const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/tasks/store');

test('listByUser only returns that user\'s tasks', () => {
  store.create('u1', { title: 'mine' });
  store.create('u2', { title: 'theirs' });
  const titles = store.listByUser('u1').map((t) => t.title);
  assert.deepEqual(titles, ['mine']);
});

test('update refuses another user\'s task', () => {
  const task = store.create('u1', { title: 'x' });
  assert.equal(store.update('u2', task.id, { status: 'done' }), null);
});
