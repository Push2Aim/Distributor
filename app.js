/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
//'use strict';

const
    bodyParser = require('body-parser'),
    crypto = require('crypto'),
    express = require('express'),
    request = require('request'),
    apiAI = require('apiai');
const db = require("./server/db.js");
const profileBuilder = require("./server/profileBuilder.js");

var app = express();

var verifier = require('alexa-verifier-middleware');
// create a router and attach to express before doing anything else
var alexaRouter = express.Router();
app.use('/alexa', alexaRouter);

// attach the verifier middleware first because it needs the entire
// request body, and express doesn't expose this on the request object
alexaRouter.use(verifier);

app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.use(bodyParser.json({verify: verifyRequestSignature}));
app.use(express.static('public'));

// Load environment variables from .env file
if (process.env.NODE_ENV !== "production")
    loadEnvironmentVariables();

function loadEnvironmentVariables() {
    let dotenv = require('dotenv');
    dotenv.load();
}

var dashbot = require('dashbot')(process.env.DASHBOT_API_KEY).facebook;

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET);

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN);

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN);

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL);

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
    console.error("Missing config values");
    process.exit(1);
}

wakeUp(process.env.ADDRESSES.split(","));

function wakeUp(addresses) {
    try {
        addresses.map((uri) => {
            request({
                    method: 'GET',
                    uri: uri
                },
                function (error, response) {
                    if (error) {
                        console.error('Error while userInfoRequest: ', error);
                    } else {
                        console.log(uri + ' result: ', response.body);
                    }
                });
        });
    } catch (err) {
        console.error("caught Error at wakeUp(%s):", addresses, err);
    }
}

let sendMessagesToIDs = function (ids, messages, url, ui = facebook) {
    console.log("send Messages to IDs", ids, messages);
    return new Promise((resolve, reject) => {
        ids.forEach(senderID => {
            ui.sendMessages(senderID, messages, null, url, (id, err) => reject(err), resolve);
        })
    })
};
let isValidatedRequest = function (req, res) {
    if (req.body.token !== VALIDATION_TOKEN) {
        res.status(400).json({error: "wrong Token"});
        console.log("wrong Token:", req.body.token);
        return false;
    }
    return true;
};
app.post('/subscription', function (req, res) {
    try {
        console.log("/subscripiton", req.body);
        if (!isValidatedRequest(req, res)) return;

        let messages = req.body.messages;
        let selectors = req.body.selectors;
        db.getAllIDs(selectors)
            .then(ids => sendMessagesToIDs(ids, messages, req.headers.host))
            .then(ids => res.json({recipients: ids, success: true}))
            .catch(err => res.status(500).json({error: err}));
    } catch (err) {
        console.error("caught Error at /subscription with req: %s; res: %s :", req.body, res, err);
    }
});

app.post('/send', function (req, res) {
    try {
        console.log("/send", req.body);
        if (!isValidatedRequest(req, res)) return;

        let messages = req.body.messages;
        let recipients = req.body.recipients;
        sendMessagesToIDs(recipients, messages, req.headers.host)
            .then(ids => res.json({recipients: ids, success: true}))
            .catch((err) => {
                console.error("Error on /send", err);
                res.status(500).json({error: err})
            });
    } catch (err) {
        console.error("caught Error at /send with req: %s; res: %s :", req.body, res, err);
    }
});

let pausedUsers = {};

function pauseUser(userId, paused) {
    pausedUsers[userId] = paused;
    console.log(userId, paused, pausedUsers);
}

app.post('/pause', function (req, res) {
    try {
        pauseUser(req.body.userId, req.body.paused);
        res.send("ok");
    } catch (err) {
        console.error("caught Error at /pause with req: %s; res: %s :", req.body, res, err);
    }
});

let xpToken = {};
app.post('/xp', function (req, res) {
    try {
        let data = xpToken[req.body.token];
        console.log("/xp", req.body.token, data);
        db.addXp(data.userId, data.context, req.body.type || "drill")
            .then(xp => res.json({success: true}))
            .catch((err) => {
                console.error("Error on /xp", err);
                res.status(500).json({error: err})
            });
        res.send("ok");
    } catch (err) {
        console.error("caught Error at /xp with req: %s; res: %s :", req.body, res, err);
    }
});

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

const alexa = require("./server/alexa");

function getSessionId(body) {
    return body.session.sessionId.replace("SessionId.", "");
}

function switchIntentRequest(body) {
    let token = body.request.locale === "de-DE" ? process.env.API_AI_ACCESS_TOKEN_DE : process.env.API_AI_ACCESS_TOKEN;
    let senderID = getSessionId(body);
    switch (body.request.intent.name) {
        case "FreeText":
            let message = body.request.intent.slots.MessageText.value;
            return sendTextRequest(senderID, message, "", alexa, token);
        case "AMAZON.CancelIntent":
            return sendTextRequest(senderID, "cancel", "", alexa, token);
        case "AMAZON.HelpIntent":
            return sendEventRequest(senderID, "HELP", "", alexa, token);
        case "AMAZON.StopIntent":
            let out = sendEventRequest(senderID, "STOP", "", alexa, token);
            out.response.shouldEndSession = true;
            return out;
        default:
            return sendEventRequest(senderID, body.request.intent.name, "", alexa);
    }
}

function getAlexaResponse(body) {
    if (body.request.type === "IntentRequest")
        return switchIntentRequest(body);
    else if (body.request.type === "LaunchRequest")
        return sendEventRequest(getSessionId(body), "WELCOME", "", alexa, token);
    else
        return Promise.resolve(alexa.sendSpeech(0, "This Action is not supported yet!"))
}

alexaRouter.post('/', function (req, res) {
    try {
        let body = req.body;
        console.log("/alexa:", JSON.stringify(body));
        if (body.session.application.applicationId !== process.env.ALEXA_APPLICAITON_ID)
            throw new Error("ApplicationId does not match!");
        if (!isTimestampValid(body))
            throw new Error("The Timestamp is invalid!");


        getAlexaResponse(body).then(s => res.status(200).send(s));
    } catch (err) {
        console.error("caught Error at /alexa with req(%s):",
            JSON.stringify(req.body), err);
        return res.status(500).json({error: err});
    }
});

function isTimestampValid(body) {
    console.log(new Date(), body.request.timestamp);
    return true;
}


/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function (req, res) {
    try {
        if (req.query['hub.mode'] === 'subscribe' &&
            req.query['hub.verify_token'] === VALIDATION_TOKEN) {
            console.log("Validating webhook");
            res.status(200).send(req.query['hub.challenge']);
        } else {
            console.error("Failed validation. Make sure the validation tokens match.");
            res.sendStatus(403);
        }
    } catch (err) {
        console.error("caught Error at /webhook with req: %s; res: %s :", req.body, res, err);
    }
});
/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */

app.post('/webhook', function (req, res) {
    try {
        dashbot.logIncoming(req.body);

        var data = req.body;

        // Make sure this is a page subscription
        if (data.object == 'page') {
            // Iterate over each entry
            // There may be multiple if batched
            data.entry.forEach(function (pageEntry) {
                var pageID = pageEntry.id;
                var timeOfEvent = pageEntry.time;

                // Iterate over each messaging event
                pageEntry.messaging.forEach(function (messagingEvent) {
                    if (messagingEvent.optin) {
                        receivedAuthentication(messagingEvent);
                    } else if (messagingEvent.postback) {
                        receivedPostback(messagingEvent, req.headers.host);
                    } else if (messagingEvent.message) {
                        receivedMessage(messagingEvent);
                    } else if (messagingEvent.delivery) {
                        receivedDeliveryConfirmation(messagingEvent);
                    } else if (messagingEvent.read) {
                        receivedMessageRead(messagingEvent);
                    } else if (messagingEvent.account_linking) {
                        receivedAccountLink(messagingEvent);
                    } else {
                        console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                    }
                });
            });

            // Assume all went well.
            //
            // You must send back a 200, within 20 seconds, to let us know you've
            // successfully received the callback. Otherwise, the request will time out.
            res.sendStatus(200);
        }
    } catch (err) {
        console.error("caught Error at /webhook with req: %s; res: %s :", req.body, res, err);
    }
});
/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */

app.get('/authorize', function (req, res) {
    try {
        var accountLinkingToken = req.query.account_linking_token;
        var redirectURI = req.query.redirect_uri;

        // Authorization Code should be generated per user by the developer. This will
        // be passed to the Account Linking callback.
        var authCode = "1234567890";

        // Redirect users to this URI on successful login
        var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

        res.render('authorize', {
            accountLinkingToken: accountLinkingToken,
            redirectURI: redirectURI,
            redirectURISuccess: redirectURISuccess
        });
    } catch (err) {
        console.error("caught Error at /authorize with req: %s; res: %s :", req.body, res, err);
    }
});

const alexaVerifier = require("./server/alexaRequestSignatureVerifier");
/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
    verifyAlexaSignature(req.headers);

    var signature = req.headers["x-hub-signature"];

    if (!signature) {
        // For testing, let's log an error. In production, you should throw an
        // error.
        console.error("Couldn't validate the signature: " + JSON.stringify(req.headers));
        // throw new Error("Couldn't validate the signature.");
    } else {
        var elements = signature.split('=');
        var method = elements[0];
        var signatureHash = elements[1];

        var expectedHash = crypto.createHmac('sha1', APP_SECRET)
            .update(buf)
            .digest('hex');

        if (signatureHash != expectedHash) {
            console.error("Couldn't validate the request signature.");
            // throw new Error("Couldn't validate the request signature.");
        }
    }
}

function verifyAlexaSignature(headers) {

}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */

function receivedAuthentication(event, ui = facebook) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfAuth = event.timestamp;

    // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
    // The developer can set this to an arbitrary value to associate the
    // authentication callback with the 'Send to Messenger' click event. This is
    // a way to do account linking when the user clicks the 'Send to Messenger'
    // plugin.
    var passThroughParam = event.optin.ref;

    console.log("Received authentication for user %d and page %d with pass " +
        "through param '%s' at %d", senderID, recipientID, passThroughParam,
        timeOfAuth);

    // When an authentication is received, we'll send a message back to the sender
    // to let them know it was successful.
    ui.sendTextMessage(senderID, "Authentication successful");
}

function makeQuickReply(payload) {
    try {
        if (payload) {
            let actionSplit = payload.toLowerCase().split("_");
            switch (actionSplit[0]) {
                case "pause":
                    return pauseUser(actionSplit[1], true);
                case "continue":
                    return pauseUser(actionSplit[1], false);
            }
        }
    } catch (err) {
        console.error("caught Error on makeQuickReply(%s):", JSON.stringify(payload), err);
    }
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    if (pausedUsers[senderID]) return console.log("paused", senderID, message);

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var isEcho = message.is_echo;
    var messageId = message.mid;
    var appId = message.app_id;
    var metadata = message.metadata;

    // You may get a text or attachment but not both
    var messageText = message.text;
    var messageAttachments = message.attachments;
    var quickReply = message.quick_reply;

    if (isEcho) {
        // Just logging message echoes to console
        console.log("Received echo for message %s and app %d with metadata %s",
            messageId, appId, metadata);
    } else if (quickReply) {
        var quickReplyPayload = quickReply.payload;
        console.log("Quick reply for message %s with payload %s",
            messageId, quickReplyPayload);
        makeQuickReply(quickReplyPayload);
        sendTextRequest(senderID, messageText).then(s => s).catch(e => e);
    }
    else if (messageText) {
        sendTextRequest(senderID, messageText).then(s => s).catch(e => e);
    } else if (messageAttachments) {
        //ThumbsUpSticker: {"mid":"mid.1483466706080:70a65f8088","seq":48327,"sticker_id":369239263222822,"attachments":[{"type":"image","payload":{"url":"https://scontent.xx.fbcdn.net/t39.1997-6/851557_369239266556155_759568595_n.png?_nc_ad=z-m","sticker_id":369239263222822}}]}
        sendEventRequest(senderID, "RANDOM_STUFF").then(s => s).catch(e => e);
    }
}

// exports.sendEventRequest = sendEventRequest;
function sendEventRequest(senderID, eventName, url, ui = facebook, token = process.env.API_AI_ACCESS_TOKEN) {
    let event = {
        name: eventName,
        data: {}
    };

    return buildApiAiRequestOptions(senderID)
        .then(options => {
            var request = apiAI(token)
                .eventRequest(event, options);
            return sendApiAiRequest(request, senderID, url, ui);
        }).catch(err => console.error(err));
}

// exports.sendTextRequest = sendTextRequest;
function buildApiAiRequestOptions(senderID) {
    return userInfoRequest(senderID)
        .then((userInfo) => db.getProfile(senderID)
            .then(userProfile => ({
                sessionId: senderID,
                contexts: [
                    {
                        name: "userInfo",
                        parameters: userInfo
                    },
                    {
                        name: "userProfile",
                        parameters: userProfile
                    },
                ]
            }))).catch(err => console.error(err));
}

function sendTextRequest(senderID, message, url = "", ui = facebook, token = process.env.API_AI_ACCESS_TOKEN) {
    return buildApiAiRequestOptions(senderID)
        .then(options => {
            let request = apiAI(token)
                .textRequest(message, options);
            return sendApiAiRequest(request, senderID, url, ui);
        }).catch(err => console.error(err));
}

function userInfoRequest(userId) {
    return new Promise((resolve, reject) => {
        request({
                method: 'GET',
                uri: "https://graph.facebook.com/v2.6/" + userId + "?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=" + PAGE_ACCESS_TOKEN
            },
            function (error, response) {
                if (error) {
                    console.error('Error while userInfoRequest: ', error);
                    reject(error);
                } else {
                    console.log('userInfoRequest result: ', response.body);
                    let userInfo = JSON.parse(response.body);
                    userInfo.fb_id = userId;
                    resolve(userInfo);
                }
            });
    });
}

function takeAction(response) {
    let extractProfile = contexts => contexts
        .find(context => context.name === "userprofile").parameters;
    let updateProfile = response =>
        db.updateProfile(response.sessionId, extractProfile(response.result.contexts));
    let addProfile = response =>
        db.addProfile(response.sessionId, extractProfile(response.result.contexts));

    function addXP(sessionId, type, amount) {
        db.addXp(sessionId, {xp: amount}, type)
    }

    try {
        if (response && response.result && response.result.action) {
            let actionSplit = response.result.action.toLowerCase().split("_");
            switch (actionSplit[0]) {
                case "updateprofile":
                    return updateProfile(response);
                case "addprofile":
                    return addProfile(response);
                case "xp":
                    return addXP(response.sessionId, actionSplit[1], actionSplit[2]);
                case "notify":
                    return notify(actionSplit[1], response);
            }
        }
    } catch (err) {
        console.error("caught Error on takeAction(%s):", JSON.stringify(response), err);
    }
}

function notify(recipientId, response, ui = facebook) {
    function sendMessage(recipientId, message) {
        ui.sendGenericMessage(recipientId, message);
    }

    function makeMessage(title) {
        return {
            title: title,
            buttons: [
                {
                    text: "Pause",
                    postback: "PAUSE_" + response.sessionId
                },
                {
                    text: "Resume",
                    postback: "RESUME_" + response.sessionId
                }
            ]
        };
    }

    return userInfoRequest(response.sessionId)
        .then((userInfo) =>
            sendMessage(recipientId,
                makeMessage(userInfo.first_name + " " + userInfo.last_name + " requested you in HebBuddy")))
        .catch(err => {
            console.error(err);
            return sendMessage(recipientId,
                makeMessage(response.sessionId + " requested you in HeyBuddy"));
        });
}

const facebook = require("./server/facebook");

function sendApiAiRequest(request, senderID, url, ui = facebook) {
    ui.sendTypingOn(senderID);
    return new Promise((resolve, reject) => {

        request.on('response', function (response) {
            console.log("ApiAi Response: ", JSON.stringify(response));
            takeAction(response);
            let messages = response.result.fulfillment.data && response.result.fulfillment.data.distributor ?
                response.result.fulfillment.data.distributor : response.result.fulfillment.messages;
            if (messages)
                resolve(ui.sendMessages(senderID, messages, response, url));
            else resolve(ui.sendSpeech(senderID, response.result.fulfillment.speech));
        });

        request.on('error', function (error) {
            console.error("Error on sendApiAiRequest", error);
            reject(ui.sendTextMessage(senderID, "Ups, something went wrong: \n" + error));
        });
        request.end();
    });
}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */
function receivedDeliveryConfirmation(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var delivery = event.delivery;
    var messageIDs = delivery.mids;
    var watermark = delivery.watermark;
    var sequenceNumber = delivery.seq;

    if (messageIDs) {
        messageIDs.forEach(function (messageID) {
            console.log("Received delivery confirmation for message ID: %s",
                messageID);
        });
    }

    console.log("All message before %d were delivered.", watermark);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */
function receivedPostback(event, url) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;

    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    var payload = event.postback.payload;

    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);

    try {
        if (payload) {
            let actionSplit = payload.toUpperCase().split("_");
            switch (actionSplit[0]) {
                case "PROFILE":
                    return sendProfile(senderID, payload, url);
                case "PAUSE":
                    return pauseUser(actionSplit[1], true);
                case "RESUME":
                    return pauseUser(actionSplit[1], false);
                default:
                    sendEventRequest(senderID, payload, url);
            }
        }
    } catch (err) {
        console.error("caught Error on receivedPostback(%s, %s):",
            JSON.stringify(event), JSON.stringify(url), err);
    }
}

function sendProfile(senderID, payload, url, ui = facebook) {
    return userInfoRequest(senderID)
        .then((userInfo) => profileBuilder(senderID)
            .then(userProfile => ({
                title: "Your Profile",
                subtitle: "share it now!",
                webview_share_button: "hide",
                buttons: [
                    {
                        text: "view Profile",
                        postback: "https://push2aim.github.io/profile/?userInfo="
                        + userInfo + "&userProfile=" + userProfile
                    }
                ]
            }))
        )
        .then(message => ui.sendGenericMessage(senderID, message))
        .catch(err => {
            sendEventRequest(senderID, payload, url);
            return console.error(err);
        })
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */

function receivedMessageRead(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    // All messages before watermark (a timestamp) or sequence have been seen.
    var watermark = event.read.watermark;
    var sequenceNumber = event.read.seq;

    console.log("Received message read event for watermark %d and sequence " +
        "number %d", watermark, sequenceNumber);

    wakeUp(process.env.ADDRESSES.split(","));
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */

function receivedAccountLink(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;

    var status = event.account_linking.status;
    var authCode = event.account_linking.authorization_code;

    console.log("Received account link event with for user %d with status %s " +
        "and auth code %s ", senderID, status, authCode);
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});

module.exports = app;