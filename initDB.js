const pool = require('./db');

const init = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS subscribers (
                                                   chat_id TEXT PRIMARY KEY
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS auto_messages (
            id SERIAL PRIMARY KEY,
            type TEXT NOT NULL,              -- 'text' или 'photo'
            content TEXT NOT NULL,           -- текст сообщения или file_id фото
            caption TEXT,                    -- необязательная подпись
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("✅ Таблицы subscribers и auto_messages созданы");
    process.exit();
};

init();
