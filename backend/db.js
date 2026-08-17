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
    `);
    console.log('PostgreSQL database schemas initialized successfully.');
  } catch (err) {
    console.error('PostgreSQL database initialization failed:', err.message);
    console.error('Please check your PostgreSQL credentials in backend/.env');
  }
}

// Automatically initialize database
initDB();

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
