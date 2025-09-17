const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/db');

const router = express.Router();

// Get all cars
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM cars';
    let params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single car
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM cars WHERE id = ?', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching car:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new car
router.post('/',
  [
    body('brand').notEmpty().withMessage('Brand is required'),
    body('model').notEmpty().withMessage('Model is required'),
    body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Valid year is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { brand, model, year, repair_time, start_date } = req.body;

      const result = await db.query(
        'INSERT INTO cars (brand, model, year, repair_time, start_date) VALUES (?, ?, ?, ?, ?)',
        [brand, model, year, repair_time || null, start_date || null]
      );

      // Get the created car
      const newCarResult = await db.query('SELECT * FROM cars WHERE id = ?', [result.lastID]);
      const newCar = newCarResult.rows[0];

      // Notify all clients
      if (global.io) {
        global.io.emit('car-added', newCar);
      }

      res.status(201).json(newCar);
    } catch (error) {
      console.error('Error creating car:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update car
router.put('/:id',
  [
    body('brand').optional().notEmpty().withMessage('Brand cannot be empty'),
    body('model').optional().notEmpty().withMessage('Model cannot be empty'),
    body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Valid year is required'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'delivered']).withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateFields = req.body;

      const fieldNames = Object.keys(updateFields);
      const fieldPlaceholders = fieldNames.map(() => '? = ?').join(', ');
      const fieldValues = fieldNames.flatMap(field => [field, updateFields[field]]);

      await db.query(
        `UPDATE cars SET ${fieldNames.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...Object.values(updateFields), id]
      );

      // Get the updated car
      const result = await db.query('SELECT * FROM cars WHERE id = ?', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Car not found' });
      }

      const updatedCar = result.rows[0];

      // Notify all clients
      if (global.io) {
        global.io.emit('car-updated', updatedCar);
      }

      res.json(updatedCar);
    } catch (error) {
      console.error('Error updating car:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete car
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM cars WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Notify all clients
    if (global.io) {
      global.io.emit('car-deleted', { id: parseInt(id) });
    }

    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;