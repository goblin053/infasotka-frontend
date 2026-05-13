import React, { useState } from 'react';

export function AdminPanel() {
  const [users, setUsers] = useState([
    { id: 1, name: 'Алексей Смирнов', role: 'student', active: true },
    { id: 2, name: 'Мария Петрова', role: 'tutor', active: true },
    { id: 3, name: 'Администратор', role: 'admin', active: true },
  ]);
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Маршруты в графе', archived: false },
    { id: 2, title: 'Логическое выражение', archived: false },
  ]);
  const [newTask, setNewTask] = useState('');

  const toggleUser = (id) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, active: !user.active } : user)));
  };

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: Date.now(), title, archived: false }]);
    setNewTask('');
  };

  const toggleTaskArchive = (id) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, archived: !task.archived } : task)));
  };

  return (
    <main>
      <h1>Панель администратора</h1>
      <p>Управление пользователями и заданиями.</p>

      <section style={{ marginBottom: 20 }}>
        <h2>Пользователи</h2>
        {users.map((user) => (
          <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>
              {user.name} ({user.role})
            </span>
            <button type="button" onClick={() => toggleUser(user.id)}>
              {user.active ? 'Деактивировать' : 'Активировать'}
            </button>
          </div>
        ))}
      </section>

      <section>
        <h2>Задания</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Название нового задания" />
          <button type="button" onClick={addTask}>
            Добавить
          </button>
        </div>
        {tasks.map((task) => (
          <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>{task.title}</span>
            <button type="button" onClick={() => toggleTaskArchive(task.id)}>
              {task.archived ? 'Вернуть' : 'В архив'}
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
