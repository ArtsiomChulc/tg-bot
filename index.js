require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const {againGameOptions} = require('./helpers/gameOptions');
const {againGame, getMainMenu, handleBroadcast, formatCronTime} = require('./helpers/helpFunctions');
const cron = require('node-cron');
const {addSubscriber, removeSubscriber, getAllSubscribers} = require('./db/subscribers');
const { saveAutoMessage, getLastAutoMessage, deleteAllAutoMessages} = require('./helpers/autoMessages');
const {setAutoBroadcastTime, scheduleAutoBroadcast} = require("./helpers/scheduleAutoBroadcast");

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const bot = new telegramApi(token, {polling: true});

const chats = {};

let pendingAutoTime;

const web_app_url = process.env.MY_APP;

const pendingBroadcasts = new Map(); // временное хранилище рассылки от админа
const pendingAutoBroadcasts = new Map(); // временное хранилище авто рассылки от админа

const startBot = async () => {
    await bot.setMyCommands([]);

    bot.on('message', async msq => {
        const text = msq.text;
        const chatId = msq.chat.id;
        const userName = msq.from.username;

        if (text === "/start") {
            console.log(userName);
            const isAdmin = userName === ADMIN_USERNAME;

            return bot.sendMessage(chatId, `Привет, ${userName || 'пользователь'}! Вот что я умею:`, getMainMenu(isAdmin));
        }

        if (text === 'ℹ️ Инфо' || text === "/info") {
            await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/a6f/1ae/a6f1ae15-7c57-3212-8269-f1a0231ad8c2/1.webp');
            return bot.sendMessage(chatId, `Ну смотри ${userName || 'пользователь'}! Бот умеет играть, подписывать/отписывать от уведомлений и показывать мое портфолио`);
        }

        if (text === '👾 Играть' || text === "/game") {
            return againGame(chatId, bot, chats)
        }

        if (text === '🌐 Портфолио' || text === "/web_app") {
            return bot.sendMessage(chatId, `Открыть портфолио`, {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Портфолио 🌐', url: web_app_url}]
                    ]
                }
            });
        }

        if (text === "📢 Подписаться" || text === "/subscribe") {
            await addSubscriber(chatId, userName);
            return bot.sendMessage(chatId, '✅ Вы подписались на рассылку.');
        }

        if (text === '📤 Рассылка' || text === "/send") {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }
            pendingBroadcasts.set(chatId, true);
            return bot.sendMessage(chatId, "✍️ Напиши сообщение, которое хочешь отправить всем подписчикам:");
        }

        if (text === '🛠 Создать авторассылку') {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }
            pendingAutoBroadcasts.set(chatId, true); // флаг для авторассылки
            return bot.sendMessage(chatId, "✍️ Напиши текст или пришли фото с подписью для авторассылки:");
        }

        if (text === '🛠 Удалить все из авторассылки' || text === "/delete") {
            await deleteAllAutoMessages();
            return bot.sendMessage(chatId, '✅ Вы удалили все из авторассылки.');
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

        if (text === "❌ Отписаться" || text === "/unsubscribe") {
            await removeSubscriber(chatId);
            return bot.sendMessage(chatId, '❌ Вы отписались от рассылки.');
        }

        if (text === '⏰ Установить время' || text === '/set_autotime') {
            if (userName !== ADMIN_USERNAME) {
                return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
            }
            pendingAutoTime = chatId;
            return bot.sendMessage(chatId, "⏰ Введите время авторассылки в формате cron (например, `0 9 * * *` для 09:00 утра):");
        }

        if (pendingAutoTime === chatId) {
            const newTime = text.trim();

            if (!/^\s*[\d\*\/,\-]+\s+[\d\*\/,\-]+\s+[\d\*\/,\-]+\s+[\d\*\/,\-]+\s+[\d\*\/,\-]+\s*$/.test(newTime)) {
                return bot.sendMessage(chatId, "⚠️ Неверный формат cron. Пример: `0 9 * * *`");
            }

            setAutoBroadcastTime(newTime);
            scheduleAutoBroadcast(bot);
            pendingAutoTime = null;

            return bot.sendMessage(chatId, `✅ Время авторассылки обновлено: ${formatCronTime(newTime)}`);
        }

        if (text === '🆘 Помощь' || text === "/help") {
            return bot.sendMessage(chatId, 'Если что-то пошло не так, отправь боту команду /start');
        }

        if (pendingAutoBroadcasts.has(chatId)) {
            pendingAutoBroadcasts.delete(chatId);
            return handleBroadcast(bot, chatId, msq, true);
        }

        if (pendingBroadcasts.has(chatId)) {
            pendingBroadcasts.delete(chatId);
            return handleBroadcast(bot, chatId, msq, false);
        }

        if(text === '⏰ Памятка CRON' || '/cron_help') {
            return bot.sendMessage(chatId, '* * * * * \n' +
                '│ │ │ │ │\n' +
                '│ │ │ │ └── День недели (0 - 7) (0 и 7 = воскресенье)\n' +
                '│ │ │ └──── Месяц (1 - 12)\n' +
                '│ │ └────── День месяца (1 - 31)\n' +
                '│ └──────── Часы (0 - 23)\n' +
                '└────────── Минуты (0 - 59)\n' +
                '*/30 * * * * каждые полчаса\n' +
                '0 * * * * каждый час в начале часа'
            )
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


startBot().then(() => {
    scheduleAutoBroadcast(bot);
    console.log('Bot started!');
});

