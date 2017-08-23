module.exports = {
    sendMessages: sendMessages,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {

}
function sendSpeech(recipientId, messageText) {

}

function sendTextMessage(recipientId, messageText, callback, timeOut) {

}
function sendGenericMessage(recipientId, message, callback, timeOut, response, url) {

}
