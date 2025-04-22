require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const {againGameOptions} = require('./gameOptions');
const {commandsForBotMenu} = require('./comands');
const {againGame} = require('./helpFunctions');

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const bot = new telegramApi(token, { polling: true });

const fs = require('fs');
const cron = require('node-cron');
const path = require('path');

const chats = {};

const web_app_url = 'https://www.youtube.com';

const SUBSCRIBERS_FILE = path.resolve(__dirname, 'subscribers.json');

// Загружаем подписчиков из файла
let subscribers = new Set();

const pendingBroadcasts = new Map(); // временное хранилище рассылки от админа

const loadSubscribers = () => {
	try {
		const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
		subscribers = new Set(JSON.parse(data));
	} catch (e) {
		subscribers = new Set(); // файл еще не создан
	}
};

const saveSubscribers = () => {
	fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([...subscribers]));
};

// Инициализация подписчиков
loadSubscribers();

const startBot = async () => {
	await bot.setMyCommands(commandsForBotMenu);
	bot.on('message', async msq => {
		const text = msq.text;
		const chatId = msq.chat.id;
		const userName = msq.from.username;

		if (pendingBroadcasts.has(chatId)) {
			const messageToSend = text;
			pendingBroadcasts.delete(chatId);
			for (let subscriberId of subscribers) {
				await bot.sendMessage(subscriberId, `📢 Рассылка: ${messageToSend}`);
			}
			return bot.sendMessage(chatId, "✅ Рассылка отправлена.");
		}


		if (text === "/start") {
			console.log(userName);
			return bot.sendMessage(chatId, `Привет! Пользуйся меню, чтобы узнать, что я умею.`);
		}
		if (text === "/info") {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/a6f/1ae/a6f1ae15-7c57-3212-8269-f1a0231ad8c2/1.webp');
			return bot.sendMessage(chatId, `Я буду называть тебя ${userName}`);
		}
		if (text === "/about_bot") {
			return bot.sendMessage(chatId, `Просто тестовый бот, который умеет загадывать число, открывать YouTube, делать рассылку`);
		}
		if (text === '/subscribe') {
			if (!subscribers.has(chatId)) {
				subscribers.add(chatId);
				saveSubscribers();
			}
			return bot.sendMessage(chatId, '✅ Вы подписались на рассылку.');
		}

		if (text === '/unsubscribe') {
			if (subscribers.has(chatId)) {
				subscribers.delete(chatId);
				saveSubscribers();
			}
			return bot.sendMessage(chatId, '❌ Вы отписались от рассылки.');
		}

		if (text === "/web_app") {
			return bot.sendMessage(chatId, `Собственно кнопка`, {
				reply_markup: {
					inline_keyboard: [
						[{ text: 'Открыть web_app', web_app: { url: web_app_url } }],
					]
				}
			});
		}
		if (text === "/game") {
			return againGame(chatId, bot, chats)
		}
		if (text === "/send") {
			if (userName !== ADMIN_USERNAME) {
				return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
			}
			pendingBroadcasts.set(chatId, true);
			return bot.sendMessage(chatId, "✍️ Напиши сообщение, которое хочешь отправить всем подписчикам:");
		}

		return bot.sendMessage(chatId, `Уупс, я тебя не понимаю...`);
	});

	bot.on('callback_query', async msq => {
		const data = msq.data;
		const chatId = msq.message.chat.id;

		await bot.editMessageReplyMarkup(
			{ inline_keyboard: [] },
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

		if (data === chats[chatId]) {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/9df/619/9df6199a-ff6a-338d-9f74-625b0a647045/1.webp');
			return bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againGameOptions)
		} else {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/49b/9af/49b9af26-a59f-415b-9f14-63c4b7979565/10.webp');
			return bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againGameOptions)
		}
	})
};


//subscribe message

cron.schedule('27 14 * * *', () => {
	subscribers.forEach(chatId => {
		bot.sendMessage(chatId, '👋 Доброе утро! Это твоя автоматическая рассылка.');
	});
});

startBot();

