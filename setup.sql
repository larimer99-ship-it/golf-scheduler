-- Golf Scheduler Database Schema

CREATE TABLE IF NOT EXISTS courses (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  address   VARCHAR(255),
  phone     VARCHAR(50),
  holes     INTEGER NOT NULL DEFAULT 18,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tees (
  id        SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  color     VARCHAR(50),
  par       INTEGER,
  yardage   INTEGER,
  rating    DECIMAL(4,1),
  slope     INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  phone      VARCHAR(50),
  handicap   DECIMAL(4,1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tee_times (
  id          SERIAL PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tee_id      INTEGER REFERENCES tees(id) ON DELETE SET NULL,
  tee_time    TIMESTAMP NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4,
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tee_time_players (
  id          SERIAL PRIMARY KEY,
  tee_time_id INTEGER NOT NULL REFERENCES tee_times(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tee_time_id, player_id)
);
