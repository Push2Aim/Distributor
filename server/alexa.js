module.exports = {
    sendMessages: sendMessages,
    sendTypingOn: sendTypingOn,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
    stop: stop,
};

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    console.log("sendMessages:", ...arguments);

    let speech = response.result.fulfillment.speech;
    if (speech.length > 0)
        return sendSpeech(senderID, speech);

    try {
        for (let i = 0; i < messages.length; i++) {
            let message = messages[i];
            console.log("message:", JSON.stringify(message));
            switch (message.type) {
                case 0:
                    if (message.speech.length > 0)
                        speech += message.speech;
                    break;
                case 2:
                    speech += quickReplyToSpeech(message);
                    break;
                default:
                    console.log("skipped:", JSON.stringify(message));
                    break;
            }
        }
        return sendSpeech(senderID, speech || "This Action is not supported yet!");
    } catch (error) {
        return reject(senderID, "Ups, something went wrong: \n" + error);
    }
}

function quickReplyToSpeech(message) {
    if (message && message.title && message.replies)
        return message.title + " You can choose: " + message.replies().join(", ");
    else return "";
}

function sendTypingOn(recipientId) {
    console.log("sendTypingOn:", ...arguments);
}

function stop() {
    return {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": "Good bye.",
            },
            "shouldEndSession": true
        }
    }
}
function sendSpeech(recipientId, messageText) {
    console.log("sendSpeech:", ...arguments);
    messageText = messageText.split(" action: ")[0];
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
