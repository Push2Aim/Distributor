module.exports = {
    sendMessages: sendMessages,
    sendTypingOn: sendTypingOn,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    console.log("sendMessages:", ...arguments);
}

function sendTypingOn(recipientId) {
    console.log("sendTypingOn:", ...arguments);
}

function sendSpeech(recipientId, messageText) {
    return {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": messageText,
            },
            "shouldEndSession": false
        }
    }
}

function sendTextMessage(recipientId, messageText, callback, timeOut) {
    sendSpeech(recipientId,messageText);
}

function sendGenericMessage(recipientId, message, callback, timeOut, response, url) {
    console.log("sendGenericMessage:", ...arguments);
}
