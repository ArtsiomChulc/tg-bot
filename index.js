require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const {againGameOptions} = require('./gameOptions');
const {againGame} = require('./helpFunctions');

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;

const bot = new telegramApi(token, { polling: true });

const fs = require('fs');
const cron = require('node-cron');
const path = require('path');

const chats = {};

const web_app_url = 'https://portfolio-chults.netlify.app';

const SUBSCRIBERS_FILE = path.resolve(__dirname, 'subscribers.json');

// Загружаем подписчиков из файла
let subscribers = new Set();

const pendingBroadcasts = new Map(); // временное хранилище рассылки от админа

const loadSubscribers = () => {
	try {
		const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
		subscribers = new Set(JSON.parse(data).map(id => String(id)));
	} catch (e) {
		subscribers = new Set(); // файл еще не создан
	}
};

const saveSubscribers = () => {
	fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([...subscribers]));
};

// Инициализация подписчиков
loadSubscribers();


const mainMenu = {
	reply_markup: {
		keyboard: [
			['ℹ️ Инфо', '👾 Играть'],
			['🌐 Портфолио', '📢 Подписка'],
			['❌ Отписка', '📤 Рассылка']
		],
		resize_keyboard: true,
		one_time_keyboard: false
	}
};

const startBot = async () => {
	bot.on('message', async msq => {
		const text = msq.text;
		const chatId = msq.chat.id;
		const userName = msq.from.username;

		if (pendingBroadcasts.has(chatId)) {
			pendingBroadcasts.delete(chatId);

			// Если сообщение — это фото
			if (msq.photo && msq.caption) {
				const photo = msq.photo[msq.photo.length - 1].file_id;
				const caption = msq.caption;
				for (let subscriberId of subscribers) {
					await bot.sendPhoto(subscriberId, photo, { caption });
				}
				return bot.sendMessage(chatId, "✅ Фото с подписью отправлено.");
			}

			// Если сообщение — это только фото (без подписи)
			if (msq.photo && !msq.caption) {
				const photo = msq.photo[msq.photo.length - 1].file_id;
				for (let subscriberId of subscribers) {
					await bot.sendPhoto(subscriberId, photo);
				}
				return bot.sendMessage(chatId, "✅ Фото без подписи отправлено.");
			}

			// Если сообщение — это текст
			if (text) {
				for (let subscriberId of subscribers) {
					await bot.sendMessage(subscriberId, `📢 Рассылка: ${text}`);
				}
				return bot.sendMessage(chatId, "✅ Текстовая рассылка отправлена.");
			}

			return bot.sendMessage(chatId, "⚠️ Поддерживается только текст и фото с подписью.");
		}


		if (text === "/start") {
			console.log(userName);
			const isAdmin = userName === ADMIN_USERNAME;
			if (isAdmin) {
				mainMenu.push(['/send', '/subs']);
			}

			return bot.sendMessage(chatId, `Привет, ${userName || 'пользователь'}! Вот что я умею:`, mainMenu);
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
				console.log(`ПОДПИСКА: Добавлен ${chatId}`);
				subscribers.add(String(chatId));
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
			return bot.sendMessage(chatId, `Открыть портфолио`, {
				reply_markup: {
					inline_keyboard: [
						[{ text: 'Портфолио 🌐', url: web_app_url }]
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

		if (text === '/subs') {
			if (userName !== ADMIN_USERNAME) {
				return bot.sendMessage(chatId, "❌ У тебя нет доступа к этой команде.");
			}

			const ids = [...subscribers];
			const count = ids.length;
			const list = ids.join('\n');

			return bot.sendMessage(chatId, `👥 Подписчиков: ${count}\n\nID:\n${list}`);
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

cron.schedule('0 */2 * * *', () => {
	console.log('Текущее время:', new Date());
	console.log('⏰ Рассылка запущена. Подписчики:', [...subscribers]);
	subscribers.forEach(chatId => {
		bot.sendMessage(chatId, '👋 Это твоя автоматическая рассылка.');
	});
});

startBot();

