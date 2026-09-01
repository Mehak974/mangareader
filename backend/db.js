require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'manga',
        port: parseInt(process.env.PGPORT || '5432'),
      }
);

// Graceful connection check & database structure initialization
async function initDB() {
  try {
    console.log('Connecting to PostgreSQL database...');
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech') && !process.env.DATABASE_URL.includes('pgbouncer=true')) {
      console.warn('⚠️ WARNING: You are connecting to Neon DB without connection pooling (?pgbouncer=true). This will lead to connection exhaustion under load.');
    }
    
    // Test connection with timeout
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 10000))
    ]);
    console.log('Database connection established');
    
    // Create tables if they do not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manga (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        cover TEXT,
        description TEXT,
        status VARCHAR(50),
        rating NUMERIC(3, 2),
        popularity INTEGER,
        country VARCHAR(50),
        format VARCHAR(50),
        banner_image TEXT,
        start_date VARCHAR(50),
        end_date VARCHAR(50),
        favorites INTEGER,
        total_chapters INTEGER,
        anilist_id VARCHAR(255),
        mal_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS metadata (
        manga_id VARCHAR(255) PRIMARY KEY REFERENCES manga(id) ON DELETE CASCADE,
        english_title VARCHAR(255),
        romaji_title VARCHAR(255),
        native_title VARCHAR(255),
        alternative_titles JSONB,
        synonyms JSONB
      );

      CREATE TABLE IF NOT EXISTS source_mappings (
        id SERIAL PRIMARY KEY,
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        source_id VARCHAR(100) NOT NULL,
        source_slug TEXT NOT NULL,
        UNIQUE(manga_id, source_id)
      );

      CREATE TABLE IF NOT EXISTS chapters_cache (
        manga_id VARCHAR(255) NOT NULL,
        source_id VARCHAR(100) NOT NULL,
        chapters JSONB NOT NULL,
        fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (manga_id, source_id)
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        source_id VARCHAR(100) NOT NULL,
        chapter_number NUMERIC(8, 2) NOT NULL,
        title VARCHAR(255),
        url TEXT NOT NULL,
        release_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(manga_id, source_id, chapter_number)
      );

      CREATE TABLE IF NOT EXISTS latest_chapter_cache (
        manga_id VARCHAR(255) PRIMARY KEY REFERENCES manga(id) ON DELETE CASCADE,
        latest_chapter_number NUMERIC(8, 2) NOT NULL,
        source_id VARCHAR(100) NOT NULL,
        release_time TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manga_genres (
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
        PRIMARY KEY(manga_id, genre_id)
      );

      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manga_tags (
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY(manga_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS authors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS manga_authors (
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES authors(id) ON DELETE CASCADE,
        role VARCHAR(100) DEFAULT 'author',
        PRIMARY KEY(manga_id, author_id, role)
      );

      CREATE TABLE IF NOT EXISTS reading_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) DEFAULT 'anonymous',
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
        last_read_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, manga_id)
      );

      CREATE TABLE IF NOT EXISTS discovered_manga (
        slug VARCHAR(255) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        chapter_count INTEGER,
        view_count INTEGER DEFAULT 1,
        last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) DEFAULT 'anonymous',
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, manga_id)
      );

      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) DEFAULT 'anonymous',
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS collection_manga (
        collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        PRIMARY KEY(collection_id, manga_id)
      );

      CREATE TABLE IF NOT EXISTS manga_notes (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        manga_id VARCHAR(255) REFERENCES manga(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, manga_id)
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS home_sections (
        section_key VARCHAR(100) PRIMARY KEY,
        media JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Seed default maintenance_mode setting if not exists
      INSERT INTO site_settings (key, value)
      VALUES ('maintenance_mode', 'false')
      ON CONFLICT (key) DO NOTHING;

      -- Create Indices for Performance
      CREATE INDEX IF NOT EXISTS idx_manga_popularity ON manga(popularity DESC);
      CREATE INDEX IF NOT EXISTS idx_manga_rating ON manga(rating DESC);
      CREATE INDEX IF NOT EXISTS idx_manga_status ON manga(status);
      CREATE INDEX IF NOT EXISTS idx_manga_title ON manga(title);
      CREATE INDEX IF NOT EXISTS idx_chapters_manga_id ON chapters(manga_id);
      CREATE INDEX IF NOT EXISTS idx_chapters_release_time ON chapters(release_time DESC);

      -- Repair serial sequences in case they drifted out of sync
      DO $$
      DECLARE
        tbl TEXT;
        seq TEXT;
        max_id BIGINT;
      BEGIN
        FOR tbl IN
          SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
            'source_mappings','chapters','genres','tags','authors','reading_history','bookmarks','collections'
          )
        LOOP
          seq := pg_get_serial_sequence('"' || tbl || '"', 'id');
          IF seq IS NOT NULL THEN
            EXECUTE format('SELECT GREATEST(MAX(id), 1) FROM %I', tbl) INTO max_id;
            EXECUTE format('SELECT setval(%L, %s, false)', seq, max_id);
            RAISE NOTICE 'Repaired sequence for %.%s -> %s', tbl, 'id', max_id + 1;
          END IF;
        END LOOP;
      END $$;

      -- Fix discovered_manga table: ensure it has the correct schema (no id column, slug is PK)
      DO $$
      BEGIN
        -- Check if discovered_manga has an id column that shouldn't be there
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'discovered_manga' AND column_name = 'id'
        ) THEN
          -- Backup data, drop and recreate table with correct schema
          CREATE TABLE IF NOT EXISTS discovered_manga_backup AS SELECT * FROM discovered_manga;
          ALTER TABLE discovered_manga DROP COLUMN id;
          RAISE NOTICE 'Removed incorrect id column from discovered_manga table';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- If dropping column fails, recreate the table
        DROP TABLE IF EXISTS discovered_manga;
        CREATE TABLE discovered_manga (
          slug VARCHAR(255) PRIMARY KEY,
          title VARCHAR(500) NOT NULL,
          chapter_count INTEGER,
          view_count INTEGER DEFAULT 1,
          last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Recreated discovered_manga table with correct schema';
      END $$;
    `);
    console.log('PostgreSQL database schemas initialized successfully.');
  } catch (err) {
    console.error('PostgreSQL database initialization failed:', err.message);
    console.error('Please check your PostgreSQL credentials in backend/.env');
  }
}

// Automatically initialize database (non-blocking, with timeout)
const initDBPromise = Promise.race([
  initDB(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Database initialization timeout after 15s')), 15000))
]).catch(err => {
  console.error('Database initialization failed:', err.message);
  console.error('Server will retry database connection on first request');
  return err;
});

// Retry connection helper for serverless environments
async function ensureConnection(retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  ensureConnection,
};
