import { useState, useCallback, useEffect } from 'react';
import { getAccessToken, googleSignIn } from '../store/firebase';

export interface TaskList {
  id: string;
  title: string;
  updated: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated: string;
}

export function useTasks() {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTaskLists = useCallback(async () => {
    try {
      setLoadingLists(true);
      setError(null);
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        token = result?.accessToken || null;
      }

      if (!token) throw new Error('No access token available');

      const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 403) throw new Error('Google Tasks API not enabled or scope missing. Please enable it in GCP console and re-login.');
      if (!res.ok) throw new Error('Failed to fetch task lists');

      const data = await res.json();
      setTaskLists(data.items || []);

      if (data.items && data.items.length > 0 && !selectedListId) {
        setSelectedListId(data.items[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load task lists');
    } finally {
      setLoadingLists(false);
    }
  }, [selectedListId]);

  const fetchTasks = useCallback(async (listId: string) => {
    try {
      setLoadingTasks(true);
      setError(null);
      let token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 403) throw new Error('Google Tasks API not enabled or scope missing. Please enable it in GCP console and re-login.');
      if (!res.ok) throw new Error('Failed to fetch tasks');

      const data = await res.json();
      setTasks(data.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const createTask = useCallback(async (listId: string, title: string, notes?: string, due?: string) => {
    try {
      let token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const body: any = { title };
      if (notes) body.notes = notes;
      if (due) body.due = due;

      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Failed to create task');

      const newTask = await res.json();
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create task');
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (listId: string, task: Task) => {
    try {
      let token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });

      if (!res.ok) throw new Error('Failed to update task');

      const updatedTask = await res.json();
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      return updatedTask;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update task');
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (listId: string, taskId: string) => {
    try {
      const confirmed = window.confirm('Are you sure you want to delete this task?');
      if (!confirmed) return;

      let token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete task');

      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete task');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchTaskLists();
  }, [fetchTaskLists]);

  useEffect(() => {
    if (selectedListId) {
      fetchTasks(selectedListId);
    }
  }, [selectedListId, fetchTasks]);

  return {
    taskLists,
    selectedListId,
    setSelectedListId,
    tasks,
    loadingLists,
    loadingTasks,
    error,
    fetchTaskLists,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask
  };
}
