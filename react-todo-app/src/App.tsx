import { useState, useEffect } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  completed: boolean
  isEditing: boolean
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [inputText, setInputText] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [editingText, setEditingText] = useState('')

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos')
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos))
    }
  }, [])

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const addTodo = () => {
    if (inputText.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputText.trim(),
        completed: false,
        isEditing: false
      }
      setTodos([...todos, newTodo])
      setInputText('')
    }
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  const toggleComplete = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const startEdit = (id: number) => {
    const todo = todos.find(t => t.id === id)
    if (todo) {
      setEditingText(todo.text)
      setTodos(todos.map(t =>
        t.id === id ? { ...t, isEditing: true } : t
      ))
    }
  }

  const saveEdit = (id: number) => {
    if (editingText.trim()) {
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, text: editingText.trim(), isEditing: false } : todo
      ))
      setEditingText('')
    }
  }

  const cancelEdit = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, isEditing: false } : todo
    ))
    setEditingText('')
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const stats = {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length
  }

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">📝 Todo List</h1>

        {/* 统计信息 */}
        <div className="stats">
          <div className="stat-item">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">总计</span>
          </div>
          <div className="stat-item">
            <span className="stat-number active">{stats.active}</span>
            <span className="stat-label">进行中</span>
          </div>
          <div className="stat-item">
            <span className="stat-number completed">{stats.completed}</span>
            <span className="stat-label">已完成</span>
          </div>
        </div>

        {/* 添加任务 */}
        <div className="input-container">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="添加新任务..."
            className="input"
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button onClick={addTodo} className="add-btn">
            添加
          </button>
        </div>

        {/* 筛选按钮 */}
        <div className="filter-container">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            进行中
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            已完成
          </button>
        </div>

        {/* 任务列表 */}
        <div className="todo-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state">
              <p>暂无任务</p>
            </div>
          ) : (
            filteredTodos.map(todo => (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleComplete(todo.id)}
                  className="checkbox"
                />
                
                {todo.isEditing ? (
                  <div className="edit-container">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="edit-input"
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(todo.id)}
                      className="icon-btn save-btn"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => cancelEdit(todo.id)}
                      className="icon-btn cancel-btn"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="todo-text">{todo.text}</span>
                    <div className="todo-actions">
                      <button
                        onClick={() => startEdit(todo.id)}
                        className="icon-btn edit-btn"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="icon-btn delete-btn"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* 清除已完成 */}
        {stats.completed > 0 && (
          <button
            onClick={() => setTodos(todos.filter(t => !t.completed))}
            className="clear-btn"
          >
            清除已完成 ({stats.completed})
          </button>
        )}
      </div>
    </div>
  )
}

export default App
