const crypto = require('node:crypto');

const tasks = new Map(); // id -> { id, userId, title, status, dueDate, createdAt }

function create(userId, { title, dueDate = null }) {
  const task = {
    id: crypto.randomUUID(),
    userId,
    title,
    status: 'open',
    dueDate,
    createdAt: new Date().toISOString(),
  };
  tasks.set(task.id, task);
  return task;
}

function listByUser(userId) {
  return [...tasks.values()].filter((t) => t.userId === userId);
}

function update(userId, id, changes) {
  const task = tasks.get(id);
  if (!task || task.userId !== userId) return null;
  Object.assign(task, changes);
  return task;
}

module.exports = { create, listByUser, update, _tasks: tasks };
