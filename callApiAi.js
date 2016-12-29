var apiai = require('apiai');
var dotenv = require('dotenv');
// Load environment variables from .env file
dotenv.load();
const API_AI_ACCESS_TOKEN = process.env.API_AI_ACCESS_TOKEN;

var app = apiai(API_AI_ACCESS_TOKEN);//<your client access token>

function sendRequest(sessionId, message) {
    var request = app.textRequest(message, {
        sessionId: sessionId
    });

    var out = null;
    request.on('response', function (response) {
        console.log(response);
        out = response;
    });

    request.on('error', function (error) {
        console.log(error);
        out = error;
    });
    request.end();
    return out;
}

