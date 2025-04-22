const pool = require('./db');

// Добавить
async function addSubscriber(chatId) {
    await pool.query(
        'INSERT INTO subscribers (chat_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [String(chatId)]
    );
}

// Удалить
async function removeSubscriber(chatId) {
    await pool.query('DELETE FROM subscribers WHERE chat_id = $1', [String(chatId)]);
}

// Получить всех
async function getAllSubscribers() {
    const res = await pool.query('SELECT chat_id FROM subscribers');
    return res.rows.map(r => r.chat_id);
}

module.exports = {
    addSubscriber,
    removeSubscriber,
    getAllSubscribers,
};
