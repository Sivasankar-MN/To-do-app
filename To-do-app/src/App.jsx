import React, { useState, useEffect, useCallback, memo } from 'react';
import './App.css';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { MdEdit, MdDelete, MdCheck, MdNotificationsActive, MdAdd, MdLogout, MdSort, MdSearch, MdPerson, MdEmail } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// LocalStorage Database Service
// This mimics database operations but uses localStorage
// Makes it easier to migrate to a real database later
const LocalDBService = {
  // User operations
  createUser: (userData) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    // Check if email already exists
    if (users.some(user => user.email === userData.email)) {
      throw new Error('Email already exists');
    }
    
    const newUser = {
      ...userData,
      uid: Date.now().toString(), // Simple unique ID
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    return newUser;
  },
  
  loginUser: (email, password) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    localStorage.setItem('loggedInUser', JSON.stringify(user));
    return user;
  },
  
  sendPasswordReset: (email) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('No account found with this email address');
    }
    
    // In a real app, this would send an email
    // Here we just simulate it
    return true;
  },
  
  logoutUser: () => {
    localStorage.removeItem('loggedInUser');
  },
  
  // Task operations
  getTasks: (userId) => {
    const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    return allTasks.filter(task => task.userId === userId);
  },
  
  addTask: (taskData) => {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const newTask = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    tasks.push(newTask);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    return newTask;
  },
  
  updateTask: (taskId, taskData) => {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }
    
    const updatedTask = {
      ...tasks[taskIndex],
      ...taskData,
      updatedAt: new Date().toISOString()
    };
    
    tasks[taskIndex] = updatedTask;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    return updatedTask;
  },
  
  deleteTask: (taskId) => {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    return true;
  }
};

const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password.length >= 6;

const ForgotPassword = memo(({ onBack }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');
    
    try {
      LocalDBService.sendPasswordReset(email);
      setMessage('Password reset link has been sent to your email.');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-with-icon">
          <MdEmail />
          <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <button type="button" onClick={onBack} className="back-button" disabled={isLoading}>
          Back to Sign In
        </button>
      </form>
    </div>
  );
});

const TaskItem = memo(({ task, onToggle, onEdit, onDelete }) => {
  const isOverdue = !task.completed && new Date(`${task.dueDate}T${task.dueTime}`) < new Date();
  return (
    <li className={`${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <span>{task.title} - {task.dueDate} {task.dueTime}
        {isOverdue && <span className="overdue-badge">OVERDUE</span>}
      </span>
      <div className="task-actions">
        <button onClick={() => onToggle(task.id)}>{task.completed ? <MdCheck /> : <MdNotificationsActive />}</button>
        <button onClick={() => onEdit(task.id)}><MdEdit /></button>
        <button onClick={() => onDelete(task.id)}><MdDelete /></button>
      </div>
    </li>
  );
});

const TaskForm = memo(({ task, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState(task || {
    title: '',
    dueDate: new Date(),
    dueTime: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        dueDate: new Date(task.dueDate)
      });
    } else {
      // Reset form when not editing
      setFormData({
        title: '',
        dueDate: new Date(),
        dueTime: ''
      });
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.dueTime.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(task ? { ...formData, id: task.id } : formData);
      
      // Clear form only for new task creation
      if (!task) {
        setFormData({
          title: '',
          dueDate: new Date(),
          dueTime: ''
        });
      }
    } catch (error) {
      toast.error("Failed to save task. Please try again.");
      console.error("Task save error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={task ? 'edit-task' : 'create-task'}>
      <input
        type="text"
        placeholder="Task Name"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        disabled={isSubmitting}
      />
      <DatePicker
        selected={formData.dueDate}
        onChange={(date) => setFormData({ ...formData, dueDate: date })}
        minDate={new Date()}
        disabled={isSubmitting}
      />
      <input
        type="time"
        value={formData.dueTime}
        onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
        disabled={isSubmitting}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : task ? <><MdCheck /> Save</> : <><MdAdd /> Add Task</>}
      </button>
      {task && <button type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>}
    </form>
  );
});

const AuthForm = memo(({ onLogin }) => {
  const [isNewUser, setIsNewUser] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    gender: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  if (showForgotPassword) return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;

  const validateForm = () => {
    const newErrors = {};
    if (!validateEmail(formData.email)) newErrors.email = '*Invalid email format';
    
    if (isNewUser) {
      if (!formData.username.trim()) newErrors.username = '*Username is required';
      if (!validatePassword(formData.password)) newErrors.password = '*Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = '*Passwords do not match';
      if (!formData.gender) newErrors.gender = '*Please select gender';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      if (isNewUser) {
        // Create new user
        const userData = {
          email: formData.email,
          username: formData.username,
          password: formData.password,
          gender: formData.gender
        };
        
        const newUser = LocalDBService.createUser(userData);
        onLogin(newUser);
      } else {
        // Login existing user
        const user = LocalDBService.loginUser(formData.email, formData.password);
        onLogin(user);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      if (isNewUser) {
        setErrors({ email: `*${error.message}` });
      } else {
        setErrors({ password: `*${error.message}` });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="profile-icon">
        <MdPerson size={100} color="#999" />
      </div>
      <h2>{isNewUser ? 'Sign Up' : 'Sign In'}</h2>
      <form onSubmit={handleAuth}>
        <input 
          type="email" 
          name="email" 
          placeholder="Email" 
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
          disabled={isLoading}
          required 
        />
        {errors.email && <span className="error">{errors.email}</span>}

        {isNewUser && (
          <>
            <input 
              type="text" 
              name="username" 
              placeholder="Username" 
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
              disabled={isLoading}
            />
            {errors.username && <span className="error">{errors.username}</span>}

            <select 
              name="gender" 
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              disabled={isLoading}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            {errors.gender && <span className="error">{errors.gender}</span>}
          </>
        )}

        <input 
          type="password" 
          name="password" 
          placeholder="Password" 
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
          disabled={isLoading}
          required 
        />
        {errors.password && <span className="error">{errors.password}</span>}

        {isNewUser && (
          <>
            <input 
              type="password" 
              name="confirmPassword" 
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} 
              disabled={isLoading}
              required 
            />
            {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}
          </>
        )}

        {!isNewUser && (
          <p className="forgot-password" onClick={() => !isLoading && setShowForgotPassword(true)}>
            Forgot Password?
          </p>
        )}

        <button type="submit" className="auth-button" disabled={isLoading}>
          {isLoading ? 'Processing...' : (isNewUser ? 'Sign Up' : 'Sign In')}
        </button>
      </form>
      <p 
        onClick={() => {
          if (!isLoading) {
            setIsNewUser(!isNewUser);
            setFormData({ email: '', username: '', password: '', confirmPassword: '', gender: '' });
            setErrors({});
          }
        }} 
        className={`toggle-auth ${isLoading ? 'disabled' : ''}`}
      >
        {isNewUser ? 'Already have an account? Sign In' : 'New user? Sign Up'}
      </p>
    </div>
  );
});

const TodoApp = ({ user, onLogout }) => {
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const setupNotifications = async () => {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
    };
    setupNotifications();
  }, []);
  
  // Load tasks from localStorage
  useEffect(() => {
    if (user?.uid) {
      setIsLoading(true);
      try {
        const userTasks = LocalDBService.getTasks(user.uid);
        setTasks(userTasks);
      } catch (error) {
        console.error("Error loading tasks:", error);
        toast.error("Failed to load tasks. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  const saveTask = useCallback(async (taskData) => {
    try {
      const updatedTask = {
        ...taskData,
        dueDate: taskData.dueDate.toISOString().split('T')[0]
      };
      
      const savedTask = LocalDBService.updateTask(taskData.id, updatedTask);
      
      setTasks(prev => prev.map(task =>
        task.id === taskData.id ? savedTask : task
      ));
      
      setEditingTask(null);
      toast.success("Task updated successfully!");
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("Failed to update task. Please try again.");
      throw error;
    }
  }, []);

  useEffect(() => {
    const checkOverdueTasks = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.completed) return;
        
        const taskDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
        if (taskDateTime < now) {
          if (notificationPermission) {
            new Notification('Task Overdue!', {
              body: `Task "${task.title}" is overdue!`,
              icon: '/favicon.ico',
              tag: `task-${task.id}`,
              requireInteraction: true
            });
          }
          toast.error(`Task "${task.title}" is overdue!`);
        }
      });
    };

    const intervalId = setInterval(checkOverdueTasks, 60000);
    checkOverdueTasks();

    return () => clearInterval(intervalId);
  }, [tasks, notificationPermission]);

  const addTask = useCallback(async (taskData) => {
    try {
      const newTaskData = {
        title: taskData.title,
        dueDate: taskData.dueDate.toISOString().split('T')[0],
        dueTime: taskData.dueTime,
        completed: false,
        userId: user.uid
      };
      
      const newTask = LocalDBService.addTask(newTaskData);
      setTasks(prev => [...prev, newTask]);
      toast.success("Task added successfully!");
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error("Failed to add task. Please try again.");
      throw error;
    }
  }, [user]);

  const editTask = useCallback((id) => {
    setEditingTask(tasks.find(task => task.id === id));
  }, [tasks]);

  const deleteTask = useCallback(async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        LocalDBService.deleteTask(id);
        setTasks(prev => prev.filter(task => task.id !== id));
        toast.success("Task deleted successfully!");
      } catch (error) {
        console.error("Error deleting task:", error);
        toast.error("Failed to delete task. Please try again.");
      }
    }
  }, []);

  const toggleComplete = useCallback(async (id) => {
    try {
      const taskToUpdate = tasks.find(task => task.id === id);
      const newCompletedState = !taskToUpdate.completed;
      
      // Update in localStorage
      const updatedTask = LocalDBService.updateTask(id, {
        completed: newCompletedState
      });
      
      // Update local state
      setTasks(prev => prev.map(task =>
        task.id === id ? updatedTask : task
      ));
      
      toast.success(newCompletedState 
        ? "Task marked as completed!" 
        : "Task marked as active!"
      );
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast.error("Failed to update task. Please try again.");
    }
  }, [tasks]);

  const handleLogout = () => {
    LocalDBService.logoutUser();
    onLogout();
  };

  const filteredAndSortedTasks = tasks
    .filter(task => task.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'dueDate') {
        return new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`);
      }
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="app-container">
      <ToastContainer position="top-right" />
      <div className="profile-header">
        <div className="profile-icon">
          <MdPerson size={40} />
        </div>
        <p>Welcome, {user.username || user.email}!</p>
        <button onClick={handleLogout} className="logout-button">
          <MdLogout /> Logout
        </button>
      </div>
      <div className="todo-container">
        <h2>Monthly Tasks</h2>
        {editingTask ? (
          <TaskForm task={editingTask} onSubmit={saveTask} onCancel={() => setEditingTask(null)} />
        ) : (
          <TaskForm onSubmit={addTask} />
        )}
        <div className="controls">
          <div className="search-bar">
            <MdSearch />
            <input type="text" placeholder="Search tasks..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setSortBy(prev => prev === 'dueDate' ? 'title' : 'dueDate')}>
            <MdSort /> Sort by {sortBy === 'dueDate' ? 'Title' : 'Due Date'}
          </button>
        </div>
        
        {isLoading ? (
          <div className="loading">Loading your tasks...</div>
        ) : filteredAndSortedTasks.length > 0 ? (
          <ul>
            {filteredAndSortedTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={toggleComplete}
                onEdit={editTask} 
                onDelete={deleteTask} 
              />
            ))}
          </ul>
        ) : (
          <p className="no-tasks">No tasks found. Add your first task above!</p>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Check for logged in user on app start
    setIsInitializing(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (isInitializing) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div className="App">
      {user ? <TodoApp user={user} onLogout={handleLogout} /> : <AuthForm onLogin={handleLogin} />}
    </div>
  );
};

export default App;