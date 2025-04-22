const pool = require('./db');

const init = async () => {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      chat_id TEXT PRIMARY KEY
    );
  `);
    console.log("✅ Таблица subscribers создана");
    process.exit();
};

init();
