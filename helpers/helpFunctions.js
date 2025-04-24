const {getAllSubscribers} = require("../db/subscribers");
const {saveAutoMessage} = require("./autoMessages");
const {gameOptions} = require("./gameOptions");

const againGame = async (chatId, bot, chats) => {
    await bot.sendMessage(chatId, `Сейчас загадаю, а ты пробуй отгадать!!!`);
    const randomNumber = Math.floor(Math.random() * 10);
    chats[chatId] = randomNumber
    await bot.sendMessage(chatId, `Отгадывай`, gameOptions);
    console.log('randomNumber', randomNumber)
}

const getMainMenu = (isAdmin = false) => ({
    reply_markup: {
        keyboard: isAdmin
            ? [
                ['ℹ️ Инфо', '👾 Играть', '🌐 Портфолио'],
                ['📢 Подписаться', '📤 Рассылка'],
                ['🛠 Создать авторассылку', '🛠 Удалить все из авторассылки'],
                ['📊 Кол-во подписчиков', '⏰ Установить время'],
                ['⏰ Памятка CRON']
            ]
            : [
                ['ℹ️ Инфо', '👾 Играть'],
                ['🌐 Портфолио', '📢 Подписаться'],
                ['❌ Отписаться', '🆘 Помощь']
            ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
});

const handleBroadcast = async (bot, chatId, msq, isAuto = false) => {
    const subscribers = await getAllSubscribers();
    const text = msq.text;

    // Фото с подписью
    if (msq.photo && msq.caption) {
        const photo = msq.photo[msq.photo.length - 1].file_id;
        for (let subscriberId of subscribers) {
            await bot.sendPhoto(subscriberId, photo, { caption: msq.caption });
        }
        if (isAuto) await saveAutoMessage({ type: 'photo', content: photo, caption: msq.caption });
        return bot.sendMessage(chatId, isAuto ? "✅ Фото с подписью сохранено и отправлено." : "✅ Фото с подписью отправлено.");
    }

    // Фото без подписи
    if (msq.photo && !msq.caption) {
        const photo = msq.photo[msq.photo.length - 1].file_id;
        for (let subscriberId of subscribers) {
            await bot.sendPhoto(subscriberId, photo);
        }
        if (isAuto) await saveAutoMessage({ type: 'photo', content: photo });
        return bot.sendMessage(chatId, isAuto ? "✅ Фото сохранено и отправлено." : "✅ Фото отправлено.");
    }

    // Текст
    if (text) {

        if (isAuto) {
            await saveAutoMessage({ type: 'text', content: text });
        }  else {
            for (let subscriberId of subscribers) {
                await bot.sendMessage(subscriberId, `📢 ${text}`);
            }
        }
        return bot.sendMessage(chatId, isAuto ? "✅ Текст сохранен и отправлен." : "✅ Сообщение отправлено.");
    }

    return bot.sendMessage(chatId, "⚠️ Поддерживается только текст и фото (с подписью или без).");
};

function formatCronTime(cronTime) {
    if(cronTime === '* * * * *') return 'каждую минуту';
    const [minute, hour] = cronTime.split(' ');
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}


module.exports = {againGame, getMainMenu, handleBroadcast, formatCronTime}