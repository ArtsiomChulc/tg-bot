const {schedule} = require("node-cron");
const {getAllSubscribers} = require("../db/subscribers");
const {getLastAutoMessage} = require("./autoMessages");

let autoBroadcastTime = '0 9 * * *'; // по умолчанию 09:00 утра

function setAutoBroadcastTime(cronTime) {
    autoBroadcastTime = cronTime;
}

function getAutoBroadcastTime() {
    return autoBroadcastTime;
}

let task;

function scheduleAutoBroadcast(bot) {
    if (task) task.stop();

    const cronTime = getAutoBroadcastTime();

    task = schedule(cronTime, async () => {
        try {
            const subscribers = await getAllSubscribers();
            const message = await getLastAutoMessage();

            if (!message) return;

            for (let chatId of subscribers) {
                if (message.type === 'text') {
                    await bot.sendMessage(chatId, `📢 ${message.content}`);
                } else if (message.type === 'photo') {
                    await bot.sendPhoto(chatId, message.content, {
                        caption: message.caption || undefined
                    });
                }
            }

            console.log("✅ Авторассылка отправлена:", message);
        } catch (err) {
            console.error("❌ Ошибка авторассылки:", err);
        }
    }, {
        timezone: "Europe/Moscow"
    });
}

module.exports = {
    setAutoBroadcastTime,
    scheduleAutoBroadcast
};
