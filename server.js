'use strict';

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

const ADMIN_USER = 'admin';
const ADMIN_HASH = '192552f284a3ac57b509b82ec5759158e368dffbf95938ef0d1eaf76969d5120'; // SHA256 of password
const sessions   = new Set(); // active tokens

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token && sessions.has(token)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const hash = crypto.createHash('sha256').update(password || '').digest('hex');
  if (username === ADMIN_USER && hash === ADMIN_HASH) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.status(204).send();
});

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

app.post('/api/players', requireAuth, async (req, res) => {
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

app.post('/api/courses', requireAuth, async (req, res) => {
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

app.put('/api/courses/:id', requireAuth, async (req, res) => {
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

app.post('/api/tees', requireAuth, async (req, res) => {
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

app.put('/api/tees/:id', requireAuth, async (req, res) => {
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

app.delete('/api/tees/:id', requireAuth, async (req, res) => {
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

// ─── Teams (persisted) ───────────────────────────────────────────────────────

pool.query(`
  CREATE TABLE IF NOT EXISTS day_teams (
    id         SERIAL PRIMARY KEY,
    date       DATE NOT NULL,
    name       TEXT NOT NULL,
    color      TEXT,
    players    JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS team_scores (
    id         SERIAL PRIMARY KEY,
    team_id    INTEGER NOT NULL REFERENCES day_teams(id) ON DELETE CASCADE,
    hole       INTEGER NOT NULL CHECK (hole BETWEEN 1 AND 18),
    score      INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, hole)
  );
`).catch(err => console.error('day_teams/team_scores init:', err));

app.get('/api/teams', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM day_teams WHERE date = $1::date ORDER BY sort_order, id',
      [date]
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teams', async (req, res) => {
  const { date, teams } = req.body;
  if (!date || !Array.isArray(teams)) return res.status(400).json({ error: 'date and teams[] required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM day_teams WHERE date = $1::date', [date]);
    const rows = [];
    for (let i = 0; i < teams.length; i++) {
      const { name, color, players } = teams[i];
      const { rows: r } = await client.query(
        'INSERT INTO day_teams (date, name, color, players, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [date, name, color || null, JSON.stringify(players || []), i]
      );
      rows.push(r[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(rows);
  } catch(err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.get('/api/team-scores', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    const { rows } = await pool.query(`
      SELECT ts.*, dt.name AS team_name, dt.color AS team_color
      FROM team_scores ts
      JOIN day_teams dt ON dt.id = ts.team_id
      WHERE dt.date = $1::date
      ORDER BY dt.sort_order, ts.hole
    `, [date]);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teams/:id/scores/:hole', async (req, res) => {
  const teamId = parseInt(req.params.id);
  const hole   = parseInt(req.params.hole);
  const { score } = req.body;
  if (hole < 1 || hole > 18) return res.status(400).json({ error: 'hole must be 1-18' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO team_scores (team_id, hole, score)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, hole) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
      RETURNING *
    `, [teamId, hole, score ?? null]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Global Hole Handicaps ────────────────────────────────────────────────────

pool.query(`
  CREATE TABLE IF NOT EXISTS hole_handicaps (
    hole         INTEGER PRIMARY KEY CHECK (hole BETWEEN 1 AND 18),
    stroke_index INTEGER CHECK (stroke_index BETWEEN 1 AND 18)
  )
`).catch(err => console.error('hole_handicaps init:', err));

app.get('/api/hole-handicaps', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM hole_handicaps ORDER BY hole');
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hole-handicaps/:hole', requireAuth, async (req, res) => {
  const hole = parseInt(req.params.hole);
  const { stroke_index } = req.body;
  if (hole < 1 || hole > 18) return res.status(400).json({ error: 'hole must be 1-18' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO hole_handicaps (hole, stroke_index)
      VALUES ($1, $2)
      ON CONFLICT (hole) DO UPDATE SET stroke_index = EXCLUDED.stroke_index
      RETURNING *
    `, [hole, stroke_index ?? null]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Hole Stroke Index + Player Scores ──────────────────────────────────────

pool.query(`
  CREATE TABLE IF NOT EXISTS hole_stroke_index (
    id           SERIAL PRIMARY KEY,
    date         DATE NOT NULL,
    hole         INTEGER NOT NULL CHECK (hole BETWEEN 1 AND 18),
    stroke_index INTEGER CHECK (stroke_index BETWEEN 1 AND 18),
    UNIQUE(date, hole)
  );
  CREATE TABLE IF NOT EXISTS player_scores (
    id          SERIAL PRIMARY KEY,
    team_id     INTEGER NOT NULL REFERENCES day_teams(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    hole        INTEGER NOT NULL CHECK (hole BETWEEN 1 AND 18),
    score       INTEGER,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, player_name, hole)
  );
`).catch(err => console.error('hole_si/player_scores init:', err));

app.get('/api/hole-si', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM hole_stroke_index WHERE date = $1::date ORDER BY hole', [date]
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/hole-si/:date/:hole', async (req, res) => {
  const hole = parseInt(req.params.hole);
  const { stroke_index } = req.body;
  if (hole < 1 || hole > 18) return res.status(400).json({ error: 'hole must be 1-18' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO hole_stroke_index (date, hole, stroke_index)
      VALUES ($1::date, $2, $3)
      ON CONFLICT (date, hole) DO UPDATE SET stroke_index = EXCLUDED.stroke_index
      RETURNING *
    `, [req.params.date, hole, stroke_index ?? null]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/player-scores', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    const { rows } = await pool.query(`
      SELECT ps.*
      FROM player_scores ps
      JOIN day_teams dt ON dt.id = ps.team_id
      WHERE dt.date = $1::date
      ORDER BY dt.sort_order, ps.player_name, ps.hole
    `, [date]);
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/teams/:id/player-scores/:hole', async (req, res) => {
  const teamId = parseInt(req.params.id);
  const hole   = parseInt(req.params.hole);
  const { player_name, score } = req.body;
  if (!player_name) return res.status(400).json({ error: 'player_name required' });
  if (hole < 1 || hole > 18) return res.status(400).json({ error: 'hole must be 1-18' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO player_scores (team_id, player_name, hole, score)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (team_id, player_name, hole) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
      RETURNING *
    `, [teamId, player_name, hole, score ?? null]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Hole Scores ─────────────────────────────────────────────────────────────

pool.query(`
  CREATE TABLE IF NOT EXISTS hole_scores (
    id          SERIAL PRIMARY KEY,
    tee_time_id INTEGER NOT NULL REFERENCES tee_times(id) ON DELETE CASCADE,
    hole        INTEGER NOT NULL CHECK (hole BETWEEN 1 AND 18),
    score       INTEGER,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tee_time_id, hole)
  )
`).catch(err => console.error('hole_scores init:', err));

app.get('/api/scores', async (req, res) => {
  const { date } = req.query;
  try {
    const { rows } = date
      ? await pool.query(`
          SELECT hs.*
          FROM hole_scores hs
          JOIN tee_times tt ON tt.id = hs.tee_time_id
          WHERE tt.tee_time::date = $1::date
          ORDER BY tt.tee_time, hs.hole
        `, [date])
      : await pool.query('SELECT * FROM hole_scores ORDER BY tee_time_id, hole');
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tee-times/:id/scores/:hole', async (req, res) => {
  const teeTimeId = parseInt(req.params.id);
  const hole      = parseInt(req.params.hole);
  const { score } = req.body;
  if (hole < 1 || hole > 18) return res.status(400).json({ error: 'hole must be 1-18' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO hole_scores (tee_time_id, hole, score)
      VALUES ($1, $2, $3)
      ON CONFLICT (tee_time_id, hole) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
      RETURNING *
    `, [teeTimeId, hole, score ?? null]);
    res.json(rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Golf Scheduler API listening on port ${PORT}`);
});
