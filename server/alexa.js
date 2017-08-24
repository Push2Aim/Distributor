module.exports = {
    sendMessages: sendMessages,
    sendTypingOn: sendTypingOn,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

const
    async = require('async');

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    resolve = resolve || sendTextMessage;
    async.eachOfSeries(messages, (message, index, callback) => {
        let timeOut = index === messages.length - 1 ? -1 : 0;
        switch (message.type) {
            case 0:
                return sendTextMessage(senderID, message.speech, callback, timeOut);
            default:
                console.log("skipped:", JSON.stringify(message));
                break;
        }
    }, error => {
        if (error)
            return reject(senderID, "Ups, something went wrong: \n" + error);
        else
            return resolve(senderID, "This Action is not supported yet!");
    });
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
