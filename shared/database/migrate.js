require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DatabaseMigrator {
    constructor(databaseUrl) {
        this.pool = new Pool({ connectionString: databaseUrl });
        this.migrationsDir = path.join(__dirname, 'migrations');
    }

    async createMigrationsTable() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    async getAppliedMigrations() {
        const result = await this.pool.query(
            'SELECT version FROM schema_migrations ORDER BY version'
        );
        return result.rows.map(row => row.version);
    }

    async getPendingMigrations() {
        const applied = await this.getAppliedMigrations();
        const files = fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        return files.filter(file => !applied.includes(file));
    }

    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (version) VALUES ($1)',
                [filename]
            );
            await client.query('COMMIT');
            console.log(`✅ Applied migration: ${filename}`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Failed to apply migration ${filename}:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async migrate() {
        try {
            console.log('🚀 Starting database migrations...');

            await this.createMigrationsTable();
            const pending = await this.getPendingMigrations();

            if (pending.length === 0) {
                console.log('✅ No pending migrations');
                return;
            }

            console.log(`📊 Running ${pending.length} migrations...`);
            for (const migration of pending) {
                await this.runMigration(migration);
            }
            console.log('✅ All migrations completed successfully');
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
    }
}

// Run migrations if called directly
if (require.main === module) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    const migrator = new DatabaseMigrator(databaseUrl);

    migrator.migrate()
        .then(() => {
            console.log('🎉 Migration process completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration process failed:', error);
            process.exit(1);
        })
        .finally(() => {
            migrator.close();
        });
}

module.exports = DatabaseMigrator;