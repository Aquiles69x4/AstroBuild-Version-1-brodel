const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/db');

const router = express.Router();

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const { status, car_id } = req.query;
    let query = `
      SELECT t.*, c.brand, c.model, c.year
      FROM tasks t
      LEFT JOIN cars c ON t.car_id = c.id
    `;
    let params = [];
    let conditions = [];

    if (status) {
      conditions.push(`t.status = ?`);
      params.push(status);
    }

    if (car_id) {
      conditions.push(`t.car_id = ?`);
      params.push(car_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT t.*, c.brand, c.model, c.year
      FROM tasks t
      LEFT JOIN cars c ON t.car_id = c.id
      WHERE t.id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new task
router.post('/',
  [
    body('car_id').isInt().withMessage('Valid car ID is required'),
    body('title').notEmpty().withMessage('Title is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { car_id, title, description, assigned_mechanic, points = 1 } = req.body;

      // Check if car exists
      const carExists = await db.query('SELECT id FROM cars WHERE id = ?', [car_id]);
      if (carExists.rows.length === 0) {
        return res.status(400).json({ error: 'Car not found' });
      }

      const result = await db.query(
        'INSERT INTO tasks (car_id, title, description, assigned_mechanic, points) VALUES (?, ?, ?, ?, ?)',
        [car_id, title, description || null, assigned_mechanic || null, points]
      );

      // Get the created task with car details
      const taskWithDetails = await db.query(`
        SELECT t.*, c.brand, c.model, c.year
        FROM tasks t
        LEFT JOIN cars c ON t.car_id = c.id
        WHERE t.id = ?
      `, [result.lastID]);

      const newTask = taskWithDetails.rows[0];

      // Notify all clients
      if (global.io) {
        global.io.emit('task-added', newTask);
      }

      res.status(201).json(newTask);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update task
router.put('/:id',
  [
    body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateFields = req.body;

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      await db.query(
        `UPDATE tasks SET ${Object.keys(updateFields).map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...Object.values(updateFields), id]
      );

      // Get the updated task with car details
      const result = await db.query(`
        SELECT t.*, c.brand, c.model, c.year
        FROM tasks t
        LEFT JOIN cars c ON t.car_id = c.id
        WHERE t.id = ?
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updatedTask = result.rows[0];

      // Notify all clients
      if (global.io) {
        global.io.emit('task-updated', updatedTask);
      }

      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM tasks WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Notify all clients
    if (global.io) {
      global.io.emit('task-deleted', { id: parseInt(id) });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;