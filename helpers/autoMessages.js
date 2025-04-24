const pool = require('../db/db');

async function saveAutoMessage({ type, content, caption = null }) {
    await pool.query(
        `INSERT INTO auto_messages (type, content, caption) VALUES ($1, $2, $3)`,
        [type, content, caption]
    );
    console.log("✅ Модуль autoMessages подключен");
}

async function getLastAutoMessage() {
    const res = await pool.query(`
        SELECT * FROM auto_messages
        ORDER BY created_at DESC
            LIMIT 1
    `);
    return res.rows[0];
}

async function deleteAllAutoMessages() {
    await pool.query(
        `DELETE FROM auto_messages`
    )
    console.log('DB cleaned')
}

module.exports = {
    saveAutoMessage,
    getLastAutoMessage,
    deleteAllAutoMessages
};
