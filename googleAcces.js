const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
require('dotenv').config();

const oauth2Client = new OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET,
	'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({
	refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const accessToken = oauth2Client.getAccessToken();

exports.module = accessToken;
