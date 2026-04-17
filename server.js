'use strict';

const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3001;

const pool = new Pool({
  user:     'golf_user',
  host:     'localhost',
  database: 'golf_scheduler',
  password: '3601Sh3fi3ld1',
  port:     5432,
});

app.use(cors());
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ─── Players ─────────────────────────────────────────────────────────────────

app.get('/api/players', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM players ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players', async (req, res) => {
  const { name, email, phone, handicap } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO players (name, email, phone, handicap) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email || null, phone || null, handicap ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/players/:id', async (req, res) => {
  const { name, email, phone, handicap } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE players SET
         name     = COALESCE($1, name),
         email    = COALESCE($2, email),
         phone    = COALESCE($3, phone),
         handicap = COALESCE($4, handicap)
       WHERE id = $5 RETURNING *`,
      [name || null, email || null, phone || null, handicap ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Player not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Player not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Courses ─────────────────────────────────────────────────────────────────

app.get('/api/courses', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM courses ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/courses', async (req, res) => {
  const { name, address, phone, holes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO courses (name, address, phone, holes) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, address || null, phone || null, holes || 18]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/courses/:id', async (req, res) => {
  const { name, address, phone, holes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE courses SET
         name    = COALESCE($1, name),
         address = COALESCE($2, address),
         phone   = COALESCE($3, phone),
         holes   = COALESCE($4, holes)
       WHERE id = $5 RETURNING *`,
      [name || null, address || null, phone || null, holes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Course not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tees ─────────────────────────────────────────────────────────────────────

app.get('/api/tees', async (req, res) => {
  try {
    const { course_id } = req.query;
    const { rows } = course_id
      ? await pool.query('SELECT * FROM tees WHERE course_id = $1 ORDER BY name', [course_id])
      : await pool.query('SELECT * FROM tees ORDER BY course_id, name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tees', async (req, res) => {
  const { course_id, name, color, par, yardage, rating, slope } = req.body;
  if (!course_id) return res.status(400).json({ error: 'course_id is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tees (course_id, name, color, par, yardage, rating, slope)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [course_id, name, color || null, par || null, yardage || null, rating || null, slope || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tees/:id', async (req, res) => {
  const { name, color, par, yardage, rating, slope } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tees SET
         name    = COALESCE($1, name),
         color   = COALESCE($2, color),
         par     = COALESCE($3, par),
         yardage = COALESCE($4, yardage),
         rating  = COALESCE($5, rating),
         slope   = COALESCE($6, slope)
       WHERE id = $7 RETURNING *`,
      [name ?? null, color || null, par ?? null, yardage ?? null, rating ?? null, slope ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tee not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tees/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tees WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tee not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tee Times ───────────────────────────────────────────────────────────────

app.get('/api/tee-times', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        tt.*,
        c.name  AS course_name,
        t.name  AS tee_name,
        t.color AS tee_color,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id, 'name', p.name, 'handicap', p.handicap,
              'tee_id', ttp.tee_id, 'transport', ttp.transport
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS players
      FROM tee_times tt
      JOIN courses c ON c.id = tt.course_id
      LEFT JOIN tees t ON t.id = tt.tee_id
      LEFT JOIN tee_time_players ttp ON ttp.tee_time_id = tt.id
      LEFT JOIN players p ON p.id = ttp.player_id
      GROUP BY tt.id, c.name, t.name, t.color
      ORDER BY tt.tee_time
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tee-times', async (req, res) => {
  const { course_id, tee_id, tee_time, max_players, notes } = req.body;
  if (!course_id || !tee_time) return res.status(400).json({ error: 'course_id and tee_time are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tee_times (course_id, tee_id, tee_time, max_players, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [course_id, tee_id || null, tee_time, max_players || 4, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tee-times/:id', async (req, res) => {
  const { course_id, tee_id, tee_time, max_players, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tee_times SET
         course_id   = COALESCE($1, course_id),
         tee_id      = COALESCE($2, tee_id),
         tee_time    = COALESCE($3, tee_time),
         max_players = COALESCE($4, max_players),
         notes       = COALESCE($5, notes)
       WHERE id = $6 RETURNING *`,
      [course_id || null, tee_id || null, tee_time || null, max_players || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tee time not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tee-times/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tee_times WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tee time not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tee Time Players ────────────────────────────────────────────────────────

app.post('/api/tee-times/:id/players', async (req, res) => {
  const { player_id } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  try {
    // Check max_players capacity
    const { rows: [tt] } = await pool.query(
      `SELECT tt.max_players, COUNT(ttp.id) AS current_count
       FROM tee_times tt
       LEFT JOIN tee_time_players ttp ON ttp.tee_time_id = tt.id
       WHERE tt.id = $1
       GROUP BY tt.id`,
      [req.params.id]
    );
    if (!tt) return res.status(404).json({ error: 'Tee time not found' });
    if (parseInt(tt.current_count) >= tt.max_players) {
      return res.status(409).json({ error: 'Tee time is full' });
    }
    const { rows } = await pool.query(
      'INSERT INTO tee_time_players (tee_time_id, player_id) VALUES ($1,$2) RETURNING *',
      [req.params.id, player_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Player already in this tee time' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tee-times/:id/players', async (req, res) => {
  const { player_id } = req.body;
  if (!player_id) return res.status(400).json({ error: 'player_id is required' });
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM tee_time_players WHERE tee_time_id = $1 AND player_id = $2',
      [req.params.id, player_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Player not found in this tee time' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tee-times/:id/players/:playerId', async (req, res) => {
  const { tee_id, transport } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tee_time_players SET
         tee_id    = COALESCE($1, tee_id),
         transport = COALESCE($2, transport)
       WHERE tee_time_id = $3 AND player_id = $4 RETURNING *`,
      [tee_id ?? null, transport || null, req.params.id, req.params.playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Player not in tee time' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Golf Scheduler API listening on port ${PORT}`);
});
