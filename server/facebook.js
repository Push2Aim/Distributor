module.exports = {
    sendMessages: sendMessages,
    sendTypingOn: sendTypingOn,
    sendSpeech: sendSpeech,
    sendTextMessage: sendTextMessage,
    sendGenericMessage: sendGenericMessage,
};

const
    request = require('request'),
    async = require('async');

// Load environment variables from .env file
if (process.env.NODE_ENV !== "production")
    loadEnvironmentVariables();
function loadEnvironmentVariables() {
    let dotenv = require('dotenv');
    dotenv.load();
}
// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN);


function sendMessages(senderID, messages, response, url, reject = sendTextMessage, resolve) {
    resolve = resolve || function (mes, id, messages) {
        return console.log(mes, id, messages)
    };
    async.eachOfSeries(messages, (message, index, callback) => {
        let timeOut = index === messages.length - 1 ? -1 : 0;
        switch (message.type) {
            case -1:
                takeABreak(senderID, callback, message.rest);
                break;
            case 0:
                sendTextMessage(senderID, message.speech, callback, timeOut);
                break;
            case 1:
                sendGenericMessage(senderID, message, callback, timeOut, response, url);
                break;
            case 2:
                sendQuickReply(senderID, message, mapQickReplies, callback, timeOut);
                break;
            case 3:
                sendImageMessage(senderID, message.imageUrl, callback, timeOut);
                break;
            case 4:
                sendCustomPayload(senderID, message.payload.facebook, callback, timeOut);
                break;
        }
    }, error => {
        if (error) reject(senderID, "Ups, something went wrong: \n" + error);
        else resolve("Successful sendMessages", senderID, messages);
    });
}


/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
    console.log("Turning typing indicator on");

    let messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: "typing_on"
    };

    callSendAPI(messageData);
}

function sendSpeech(recipientId, messageText) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };

    callSendAPI(messageData);
}

let takeABreak = function (senderID, callback, timeOut) {
    sendTypingOn(senderID);
    setTimeout(callback, timeOut);
};

let attachments = {};
function minimizeAttachment(messageData) {
    if (messageData.message && messageData.message.attachment && messageData.message.attachment.type !== "template") {
        if (messageData.message.attachment && attachments[messageData.message.attachment])
            messageData.message.attachment.payload =
                {
                    attachment_id: attachments[JSON.stringify(messageData.message.attachment)]
                };
        else messageData.message.attachment.payload.is_reusable = true;
    }
    return messageData;
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData, callback, timeOut) {
    let requestData = {
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: minimizeAttachment(messageData)
    };

    function fromPicgen() {
        try {
            console.log("fromPicgen url:",messageData.message.attachment.payload.url);
            return messageData.message.attachment.payload.url.includes("picgen");
        } catch (err) {
            return false;
        }
    }

    request(requestData, (error, response, body) => {
        dashbot.logOutgoing(requestData, response.body);

        if (!error && response.statusCode === 200) {
            let recipientId = body.recipient_id;
            let messageId = body.message_id;
            let attachmentId = body.attachment_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
                if(attachmentId && !fromPicgen()){
                    console.log("save attachment_id:", attachmentId);
                    attachments[JSON.stringify(messageData)] = attachmentId;
                }

                if (timeOut >= 0) {
                    let senderID = messageData.recipient.id;
                    takeABreak(senderID, callback, timeOut);
                } else callback;

            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            try {
                callback(new Error("Failed calling Send API " + response.statusCode + " " +
                    response.statusMessage + " " + JSON.stringify(body.error) +
                    " messageData: " + JSON.stringify(messageData)));
            } catch (err) {
                callback;
            }
        }
    });
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText, callback, timeOut) {
    messageText = messageText.split(" action: ")[0];
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
            metadata: "DEVELOPER_DEFINED_METADATA"
        }
    };

    callSendAPI(messageData, callback, timeOut);
}
let xpToken = {};
function buildToken(userId = 0, duration) {
    let token = userId + new Date();
    try {
        xpToken[token] = {
            userId: userId,
            context: {xp: duration * 10}
        };
        console.log("buildToken", token, xpToken[token]);
    } catch (err) {
        console.error("Error on buildToken", err);
    }
    return token;
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId, message, callback, timeOut, response, url) {
    let duration = response ? response.result.parameters.duration || 0 : 0;
    let amount = duration ? duration.amount : 30;
    let ratio = "compact";
    if (response && response.result && response.result.action) {
        let split = response.result.action.split(":");
        ratio = split[0] === "webview_height_ratio" ? split[1] : "compact";
    }

    function buildXpData() {
        return "&token=" + buildToken(recipientId, amount)
            + "&url=" + url;
    }

    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    image_aspect_ratio: "square",
                    elements: [{
                        title: message.title.replace("$duration.amount", amount),
                        subtitle: message.subtitle,
                        // item_url: "https://push2aim.com",
                        image_url: message.imageUrl || "https://jspicgen.herokuapp.com/?type=WYN&duration=" + amount,
                        buttons: message.buttons.map(btn => {
                            if (btn.postback.startsWith("+")) {
                                return ({
                                    type: "phone_number",
                                    title: btn.text,
                                    payload: btn.postback
                                });
                            } else if (btn.postback.startsWith("https://") || btn.postback.startsWith("http://")) {
                                let url = btn.postback.replace("http://", "https://");
                                if (url.startsWith("https://push2aim.github.io/webview/?duration="))
                                    url += buildXpData();

                                return ({
                                    type: "web_url",
                                    title: btn.text,
                                    url: url,
                                    webview_height_ratio: ratio,
                                    messenger_extensions: true,
                                });
                            } else if (btn.postback === "") {
                                return ({
                                    type: "web_url",
                                    title: btn.text,
                                    url: "https://push2aim.github.io/webview/?duration=" + amount + buildXpData(),
                                    webview_height_ratio: "compact",
                                    messenger_extensions: true,
                                });
                            } else if (btn.postback === "element_share") {
                                return ({
                                    type: "element_share"
                                });
                            } else {
                                return ({
                                    type: "postback",
                                    title: btn.text,
                                    payload: btn.postback
                                });
                            }
                        })
                    }]
                }
            }
        }
    };

    callSendAPI(messageData, callback, timeOut);
}


/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId, message, map = mapQickReplies, callback = null, timeOut = -1) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: message.title,
            quick_replies: message.replies.map(map)
        }
    };

    callSendAPI(messageData, callback, timeOut);
}
function mapQickReplies(title, payload = "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION") {
    let split = title.split("http");
    let url = split.length >= 2 ? "http" + split[1] : "";
    return ({
        "content_type": "text",
        "title": split[0],
        "payload": payload,
    });
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId, url, callback, timeOut) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "image",
                payload: {
                    url: url
                }
            }
        }
    };

    callSendAPI(messageData, callback, timeOut);
}

function sendCustomPayload(recipientId, payload, callback, timeOut) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: payload.attachment
        }
    };

    callSendAPI(messageData, callback, timeOut);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Welcome. Link your account.",
                    buttons: [{
                        type: "account_link",
                        url: SERVER_URL + "/authorize"
                    }]
                }
            }
        }
    };

    callSendAPI(messageData);
}