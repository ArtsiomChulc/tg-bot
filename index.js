require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const { againGameOptions } = require('./helpers/gameOptions');
const { againGame, getMainMenu, handleBroadcast, formatCronTime } = require('./helpers/helpFunctions');
const { addSubscriber, removeSubscriber, getAllSubscribers } = require('./db/subscribers');
const { deleteAllAutoMessages } = require('./helpers/autoMessages');
const { setAutoBroadcastTime, scheduleAutoBroadcast } = require("./helpers/scheduleAutoBroadcast");

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const bot = new telegramApi(token, { polling: true });

const chats = {};
let pendingAutoTime = null;
const web_app_url = process.env.MY_APP;
const pendingBroadcasts = new Map();
const pendingAutoBroadcasts = new Map();

const startBot = async () => {
    bot.on('message', async (msg) => {
        try {
            const text = msg.text;
            const chatId = msg.chat.id;
            const userName = msg.from.username;

            if (!text) return;

            switch (text) {
                case "/start":
                    return sendStartMessage(chatId, userName);
                case 'ℹ️ Инфо':
                case "/info":
                    return sendInfoMessage(chatId, userName);
                case '👾 Играть':
                case "/game":
                    return againGame(chatId, bot, chats);
                case '🌐 Портфолио':
                case "/web_app":
                    return bot.sendMessage(chatId, web_app_url);
                case "📢 Подписаться":
                case "/subscribe":
                    await addSubscriber(chatId, userName);
                    return bot.sendMessage(chatId, '✅ Вы подписались на рассылку.');
                case '📤 Рассылка':
                case "/send":
                    return handleAdminCommand(chatId, userName, pendingBroadcasts, "✍️ Напиши сообщение, которое хочешь отправить всем подписчикам:");
                case '🛠 Создать авторассылку':
                    return handleAdminCommand(chatId, userName, pendingAutoBroadcasts, "✍️ Напиши текст или пришли фото с подписью для авторассылки:");
                case '🛠 Удалить все из авторассылки':
                case "/delete":
                    await deleteAllAutoMessages();
                    return bot.sendMessage(chatId, '✅ Вы удалили все из авторассылки.');
                case '📊 Кол-во подписчиков':
                case '/subs':
                    return handleSubscriberCount(chatId, userName);
                case "❌ Отписаться":
                case "/unsubscribe":
                    await removeSubscriber(chatId);
                    return bot.sendMessage(chatId, '❌ Вы отписались от рассылки.');
                case '⏰ Установить время':
                case '/set_autotime':
                    return handleSetAutoTime(chatId, userName);
                case '🆘 Помощь':
                case "/help":
                    return bot.sendMessage(chatId, 'Если что-то пошло не так, отправь боту команду /start');
                case '⏰ Памятка CRON':
                case '/cron_help':
                    return sendCronHelp(chatId);
                default:
                    if (pendingAutoTime === chatId) {
                        return handleAutoTimeInput(chatId, text);
                    }
                    if (pendingAutoBroadcasts.has(chatId)) {
                        pendingAutoBroadcasts.delete(chatId);
                        return handleBroadcast(bot, chatId, msg, true);
                    }
                    if (pendingBroadcasts.has(chatId)) {
                        pendingBroadcasts.delete(chatId);
                        return handleBroadcast(bot, chatId, msg, false);
                    }
                    return bot.sendMessage(chatId, `Уупс, я тебя не понимаю...`);
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    });

    bot.on('callback_query', async (msg) => {
        try {
            const data = msg.data;
            const chatId = msg.message.chat.id;

            await bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                { chat_id: chatId, message_id: msg.message.message_id }
            );

            if (data === '/again') {
                return againGame(chatId, bot, chats);
            }

            if (String(data) === String(chats[chatId])) {
                await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/9df/619/9df6199a-ff6a-338d-9f74-625b0a647045/1.webp');
                return bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againGameOptions);
            } else {
                await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/49b/9af/49b9af26-a59f-415b-9f14-63c4b7979565/10.webp');
                return bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againGameOptions);
            }
        } catch (error) {
            console.error("Error handling callback query:", error);
        }
    });
};

const sendStartMessage = (chatId, userName) => {
    const isAdmin = userName === ADMIN_USERNAME;
    return bot.sendMessage(chatId, `Привет, ${userName || 'пользователь'}! Вот что я умею:`, getMainMenu(isAdmin));
};

const sendInfoMessage = async (chatId, userName) => {
    await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/a6f/1ae/a6f1ae15-7c57-3212-8269-f1a0231ad8c2/1.webp');
    return bot.sendMessage(chatId, `Ну смотри ${userName || 'пользователь'}! Бот умеет играть, подписывать/отписывать от уведомлений и показывать мое портфолио`);
};

const handleAdminCommand = (chatId, userName, pendingMap, message) => {
    if (userName !== ADMIN_USERNAME) {
        return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
    }
    pendingMap.set(chatId, true);
    return bot.sendMessage(chatId, message);
};

const handleSubscriberCount = async (chatId, userName) => {
    if (userName !== ADMIN_USERNAME) {
        return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
    }

    const subscribers = await getAllSubscribers();
    const count = subscribers.length;
    const ids = subscribers.join('\n');

    return bot.sendMessage(chatId, `👥 Подписчиков: ${count}\n\nID:\n${ids}`);
};

const handleSetAutoTime = (chatId, userName) => {
    if (userName !== ADMIN_USERNAME) {
        return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
    }
    pendingAutoTime = chatId;
    return bot.sendMessage(chatId, "⏰ Введите время авторассылки в формате cron (например, `0 9 * * *` для 09:00 утра):");
};

const handleAutoTimeInput = (chatId, text) => {
    const newTime = text.trim();

    if (!/^\s*[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s+[\d*\/,\-]+\s*$/.test(newTime)) {
        return bot.sendMessage(chatId, "⚠️ Неверный формат cron. Пример: `0 9 * * *`");
    }

    setAutoBroadcastTime(newTime);
    scheduleAutoBroadcast(bot);
    pendingAutoTime = null;

    return bot.sendMessage(chatId, `✅ Время авторассылки обновлено: ${formatCronTime(newTime)}`);
};

const sendCronHelp = (chatId) => {
    return bot.sendMessage(chatId, '* * * * * \n' +
        '│ │ │ │ │\n' +
        '│ │ │ │ └── День недели (0 - 7) (0 и 7 = воскресенье)\n' +
        '│ │ │ └──── Месяц (1 - 12)\n' +
        '│ │ └────── День месяца (1 - 31)\n' +
        '│ └──────── Часы (0 - 23)\n' +
        '└────────── Минуты (0 - 59)\n' +
        '*/30 * * * * каждые полчаса\n' +
        '0 * * * * каждый час в начале часа'
    );
};

startBot().then(() => {
    scheduleAutoBroadcast(bot);
    console.log('Bot started!');
});
