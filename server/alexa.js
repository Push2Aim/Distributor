module.exports = {
    sendMessages: sendMessages,
    sendTypingOn: sendTypingOn,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    console.log("sendMessages:", ...arguments);

    let speech = response.result.fulfillment.speech;
    if (speech.length > 0)
        return sendSpeech(senderID, speech);
    let card;
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
                case 3:
                case 1:
                    card = sendGenericMessage(senderID, message, null, null, response, url);
                    break;
                default:
                    console.log("skipped:", JSON.stringify(message));
                    break;
            }
        }
        return sendSpeech(senderID, speech || "This Action is not supported yet!", card);
    } catch (error) {
        return reject(senderID, "Ups, something went wrong: \n" + error);
    }
}

function quickReplyToSpeech(message) {
    if (message && message.title && message.replies)
        return message.title + " You can choose: " + message.replies.join(", ");
    else return "";
}

function sendTypingOn(recipientId) {
    console.log("sendTypingOn:", ...arguments);
}

function sendSpeech(recipientId, messageText, card) {
    console.log("sendSpeech:", ...arguments);
    messageText = messageText.split(" action: ")[0];
    let out = {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": messageText,
            },
            "shouldEndSession": false
        }
    };
    if (card) out.response.card = card;
    return out;
}

function sendTextMessage(recipientId, messageText, callback, timeOut) {
    return sendSpeech(recipientId,messageText);
}

function sendGenericMessage(recipientId, message, callback, timeOut, response, url) {
    console.log("sendGenericMessage:", ...arguments);

    let duration = response ? response.result.parameters.duration || 0 : 0;
    let amount = duration ? duration.amount : 30;

    let out = {
        type: "Standard",
        image: {
            largeImageUrl: message.imageUrl || "https://jspicgen.herokuapp.com/?type=WYN&duration=" + amount,
        }
    };
    if (message.title)
        out.title = message.title.replace("$duration.amount", amount);
    if (message.subtitle)
        out.text = message.subtitle;
    else if (message.buttons && message.buttons.length > 0)
        out.text = buildPostback(message.buttons[0], amount);
    return out;
}

function buildPostback(button, amount) {
    return !button.postback || button.postback === "" ?
        "https://push2aim.github.io/webview/?duration=" + amount :
        button.postback;
}
