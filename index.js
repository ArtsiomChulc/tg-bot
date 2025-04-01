require('dotenv').config();
const telegramApi = require('node-telegram-bot-api');
const {againGameOptions} = require('./gameOptions');
const {commandsForBotMenu} = require('./comands');
const {againGame} = require('./helpFunctions');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new telegramApi(token, { polling: true });

const chats = {};

const web_app_url = 'https://www.youtube.com';

const startBot = async () => {
	await bot.setMyCommands(commandsForBotMenu);
	bot.on('message', async msq => {
		const text = msq.text;
		const chatId = msq.chat.id;
		const userName = msq.from.username;

		if (text === "/start") {
			console.log(userName);
			return bot.sendMessage(chatId, `Привет, пройдись по меню и узнай что может этот тестовый бот`);
		}
		if (text === "/info") {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/a6f/1ae/a6f1ae15-7c57-3212-8269-f1a0231ad8c2/1.webp');
			return bot.sendMessage(chatId, `Я буду называть тебя ${userName}`);
		}
		if (text === "/about_bot") {
			return bot.sendMessage(chatId, `Появилась кнопочка с игрой, есть кнопочка с web-приложением (пока YOUTUBE), так-что давай, жмякай ${userName}`);
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

		return bot.sendMessage(chatId, `Уупс, я тебя не понимаю...`);
	});

	bot.on('callback_query', async msq => {
		const data = msq.data;
		const chatId = msq.message.chat.id;
		if (data === '/again') {
			return againGame(chatId, bot, chats)
		}
		console.log('data', data)
		console.log('chats', chats[chatId])

		if (data == chats[chatId]) {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/9df/619/9df6199a-ff6a-338d-9f74-625b0a647045/1.webp');
			return bot.sendMessage(chatId, `Поздравляю, ты отгадал цифру ${chats[chatId]}`, againGameOptions)
		} else {
			await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/49b/9af/49b9af26-a59f-415b-9f14-63c4b7979565/10.webp');
			return bot.sendMessage(chatId, `К сожалению ты не угадал, бот загадал цифру ${chats[chatId]}`, againGameOptions)
		}
	})
};

startBot();

