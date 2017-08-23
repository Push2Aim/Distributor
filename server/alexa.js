module.exports = {
    sendMessages: sendMessages,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    console.log("sendMessages(%s)", arguments)
}
function sendSpeech(recipientId, messageText) {
    console.log("sendSpeech(%s)", arguments)
}

function sendTextMessage(recipientId, messageText, callback, timeOut) {
    console.log("sendTextMessage(%s)", arguments)
}
function sendGenericMessage(recipientId, message, callback, timeOut, response, url) {
    console.log("sendGenericMessage(%s)", arguments)
}
