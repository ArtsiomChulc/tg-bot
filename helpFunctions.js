const {gameOptions} = require("./gameOptions");

const againGame = async (chatId, bot, chats) => {
    await bot.sendMessage(chatId, `Сейчас загадаю, а ты пробуй отгадать!!!`);
    const randomNumber = Math.floor(Math.random() * 10);
    chats[chatId] = randomNumber
    await bot.sendMessage(chatId, `Отгадывай`, gameOptions);
    console.log('randomNumber', randomNumber)
}

module.exports = {againGame}