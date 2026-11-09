CREATE TABLE latest (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  recorded_at INTEGER NOT NULL,
  soil_adc INTEGER NOT NULL CHECK (soil_adc BETWEEN 0 AND 4095),
  temperature REAL,
  humidity REAL,
  pump_on INTEGER NOT NULL CHECK (pump_on IN (0, 1)),
  pump_fault INTEGER NOT NULL CHECK (pump_fault IN (0, 1)),
  uptime_ms INTEGER NOT NULL
);

CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  minute_bucket INTEGER NOT NULL UNIQUE,
  recorded_at INTEGER NOT NULL,
  soil_adc INTEGER NOT NULL,
  temperature REAL,
  humidity REAL,
  pump_on INTEGER NOT NULL,
  pump_fault INTEGER NOT NULL
);
CREATE INDEX readings_time ON readings(recorded_at);

CREATE TABLE pump_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at INTEGER NOT NULL,
  pump_on INTEGER NOT NULL,
  soil_adc INTEGER NOT NULL
);
CREATE INDEX pump_events_time ON pump_events(recorded_at);

CREATE TRIGGER log_pump_transition BEFORE UPDATE ON latest
WHEN OLD.pump_on != NEW.pump_on
BEGIN
  INSERT INTO pump_events(recorded_at, pump_on, soil_adc)
  VALUES (NEW.recorded_at, NEW.pump_on, NEW.soil_adc);
END;

CREATE TRIGGER log_initial_pump AFTER INSERT ON latest
WHEN NEW.pump_on = 1
BEGIN
  INSERT INTO pump_events(recorded_at, pump_on, soil_adc)
  VALUES (NEW.recorded_at, NEW.pump_on, NEW.soil_adc);
END;
