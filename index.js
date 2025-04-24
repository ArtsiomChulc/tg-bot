require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const cron = require('node-cron');
const {getMainMenu, againGame} = require("./helpers/helpFunctions");
const {removeSubscriber, addSubscriber, getAllSubscribers} = require("./db/subscribers");
const {saveAutoMessage, getLastAutoMessage} = require("./helpers/autoMessages");
const {againGameOptions} = require("./helpers/gameOptions");

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const bot = new telegramApi(token, {polling: true});

const chats = {};

const web_app_url = process.env.MY_APP;

const pendingBroadcasts = new Map(); // временное хранилище рассылки от админа
const pendingAutoBroadcasts = new Map(); // временное хранилище авто рассылки от админа

const startBot = async () => {
    bot.on('message', async msq => {
        const text = msq.text;
        const chatId = msq.chat.id;
        const userName = msq.from.username;

        if (text === "/start") {
            console.log(userName);
            const isAdmin = userName === ADMIN_USERNAME;

            // return bot.sendMessage(chatId, `Привет, ${userName || 'пользователь'}! Вот что я умею:`);
            return bot.sendMessage(chatId, `Привет, ${userName || 'пользователь'}! Вот что я умею:`, getMainMenu(isAdmin));
        }

        if (text === 'ℹ️ Инфо' || text === "/info") {
            await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/a6f/1ae/a6f1ae15-7c57-3212-8269-f1a0231ad8c2/1.webp');
            return bot.sendMessage(chatId, `Ну смотри ${userName || 'пользователь'}! Бот умеет играть, подписывать/отписывать от уведомлений и показывать мое портфолио`);
        }

        if (text === "📢 Подписаться" || text === "/subscribe") {
            await addSubscriber(chatId);
            return bot.sendMessage(chatId, '✅ Вы подписались на рассылку.');
        }

        if (text === "❌ Отписаться" || text === "/unsubscribe") {
            await removeSubscriber(chatId);
            return bot.sendMessage(chatId, '❌ Вы отписались от рассылки.');
        }

        // if (text === '🌐 Портфолио' || text === "/web_app") {
        //     return bot.sendMessage(chatId, `Открыть портфолио`, {
        //         reply_markup: {
        //             inline_keyboard: [
        //                 [{text: 'Портфолио 🌐', url: web_app_url}]
        //             ]
        //         }
        //     });
        // }

        if (text === '🆘 Помощь' || text === "/help") {
            return bot.sendMessage(chatId, 'Если что-то пошло не так, отправь боту команду /start');
        }

        if (text === '👾 Играть' || text === "/game") {
            return againGame(chatId, bot, chats)
        }
        if (text === '📤 Рассылка' || text === "/send") {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }
            pendingBroadcasts.set(chatId, true);
            return bot.sendMessage(chatId, "✍️ Напиши сообщение, которое хочешь отправить всем подписчикам:");
        }

        if (text === '📊 Кол-во подписчиков' || text === '/subs') {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }

            const subscribers = await getAllSubscribers();
            const count = subscribers.length;
            const ids = subscribers.join('\n');

            return bot.sendMessage(chatId, `👥 Подписчиков: ${count}\n\nID:\n${ids}`);
        }

        if (text === '🛠 Создать авторассылку') {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }
            pendingAutoBroadcasts.set(chatId, true); // флаг для авторассылки
            return bot.sendMessage(chatId, "✍️ Напиши текст или пришли фото с подписью для авторассылки:");
        }

        if (pendingAutoBroadcasts.has(chatId)) {
            pendingAutoBroadcasts.delete(chatId);

            // Если сообщение — это фото
            if (msq.photo && msq.caption) {
                const photo = msq.photo[msq.photo.length - 1].file_id;
                const subscribers = await getAllSubscribers();
                const caption = msq.caption;
                for (let subscriberId of subscribers) {
                    await bot.sendPhoto(subscriberId, photo, {caption});
                    await saveAutoMessage({type: 'photo', content: photo, caption: caption});
                }
                return bot.sendMessage(chatId, "✅ Фото с подписью отправлено.");
            }

            // Если сообщение — это только фото (без подписи)
            if (msq.photo && !msq.caption) {
                const photo = msq.photo[msq.photo.length - 1].file_id;
                const subscribers = await getAllSubscribers();
                for (let subscriberId of subscribers) {
                    await saveAutoMessage({type: 'photo', content: photo, caption: msq.photo});
                    await bot.sendPhoto(subscriberId, photo);
                }
                return bot.sendMessage(chatId, "✅ Фото без подписи отправлено.");
            }

            // Если сообщение — это текст
            if (text) {
                const subscribers = await getAllSubscribers();
                for (let subscriberId of subscribers) {
                    await bot.sendMessage(subscriberId, `📢 Рассылка: ${text}`);
                    await saveAutoMessage({type: 'text', content: text});
                }
                return bot.sendMessage(chatId, "✅ Текстовая рассылка отправлена.");
            }

            return bot.sendMessage(chatId, "⚠️ Поддерживается только текст и фото (с подписью или без).");
        }

        if (pendingAutoBroadcasts.get(chatId) === 'auto') {
            pendingAutoBroadcasts.delete(chatId);

            if (msq.photo && msq.caption) {
                const photo = msq.photo[msq.photo.length - 1].file_id;
                await saveAutoMessage({ type: 'photo', content: photo, caption: msq.caption });
                return bot.sendMessage(chatId, "✅ Фото с подписью сохранено для авторассылки.");
            }

            if (msq.photo && !msq.caption) {
                const photo = msq.photo[msq.photo.length - 1].file_id;
                await saveAutoMessage({ type: 'photo', content: photo });
                return bot.sendMessage(chatId, "✅ Фото без подписи сохранено для авторассылки.");
            }

            if (text) {
                await saveAutoMessage({ type: 'text', content: text });
                return bot.sendMessage(chatId, "✅ Текстовое сообщение сохранено для авторассылки.");
            }

            return bot.sendMessage(chatId, "⚠️ Поддерживается только текст или фото (с подписью или без).");
        }

        return bot.sendMessage(chatId, `Уупс, я тебя не понимаю...`);
    });

    bot.on('callback_query', async msq => {
        const data = msq.data;
        const chatId = msq.message.chat.id;

        await bot.editMessageReplyMarkup(
            {inline_keyboard: []},
            {
                chat_id: chatId,
                message_id: msq.message.message_id,
            }
        );

        if (data === '/again') {
            return againGame(chatId, bot, chats)
        }
        console.log('data', data)
        console.log('chats', chats[chatId])

        if (String(data) === String(chats[chatId])) {
            await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/9df/619/9df6199a-ff6a-338d-9f74-625b0a647045/1.webp');
            return bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againGameOptions)
        } else {
            await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/49b/9af/49b9af26-a59f-415b-9f14-63c4b7979565/10.webp');
            return bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againGameOptions)
        }
    })
};


//subscribe message

cron.schedule('30 8 * * *', async () => {
    try {
        const subscribers = await getAllSubscribers();
        const message = await getLastAutoMessage();

        if (!message) {
            console.log("📭 Нет авторассылок для отправки");
            return;
        }

        for (let chatId of subscribers) {
            if (message.type === 'text') {
                await bot.sendMessage(chatId, `📢 ${message.content}`);
            } else if (message.type === 'photo') {
                await bot.sendPhoto(chatId, message.content, {
                    caption: message.caption || undefined
                });
            }
        }

        console.log("✅ Авторассылка успешно отправлена:", message);
    } catch (err) {
        console.error("❌ Ошибка авторассылки:", err);
    }
}, {
    timezone: "Europe/Moscow"
});

startBot().then(() => {
    console.log('Bot started!');
});

