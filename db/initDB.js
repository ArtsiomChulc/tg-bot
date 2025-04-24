const pool = require('./db');

const init = async () => {
    try {
        // Создание таблицы subscribers, если не существует
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                chat_id TEXT PRIMARY KEY
            );
        `);

        // Добавление username в таблицу subscribers, если его нет
        await pool.query(`
            ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS username TEXT;
        `);

        // Создание таблицы auto_messages, если не существует
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auto_messages (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,           -- 'text' или 'photo'
                content TEXT NOT NULL,        -- текст сообщения или file_id фото
                caption TEXT,                 -- необязательная подпись
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("✅ Таблицы subscribers и auto_messages обновлены");
    } catch (error) {
        console.error("❌ Ошибка инициализации базы данных:", error);
    } finally {
        process.exit();
    }
};

init();
