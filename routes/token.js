const router = require('express').Router();
const User = require('../models/user').User;
const Token = require('../models/token');
const accessToken = require('../googleAcces');
const jwt = require('jsonwebtoken');

router.get('/:token', async (req, res) => {
	const token = await Token.findOne({ token: req.params.token });
	if (!token || token.type !== 'authorization') return res.status(400).send('Nu s-a gasit un token valid');

	const user = await User.findOne({ _id: token.user });
	if (!user) return res.status(400).send('Nu s-a gasit user cu acest token');
	if (user.active) return res.status(400).send('User deja confirmat');

	user.active = true;
	try {
		await user.save();
	} catch (error) {
		return res.status(500).send('User nu s-a activat');
	}

	const jwtToken = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET);
	res.cookie('Authorization', `Bearer ${jwtToken}`);
	res.redirect(302, 'http://localhost:3000/');
});

router.get('/recovery/:token', async (req, res) => {
	const token = await Token.findOne({ token: req.params.token });
	if (!token || token.type !== 'recovery') return res.status(400).send('Nu s-a gasit un token valid');


	res.redirect(302, `http://localhost:3000/reset/${token.token}`);
});

router.post('/resend', async (req, res) => {
	const user = await User.findOne({ email: req.body.email });
	if (!user) return res.status(400).send('Nu s-a gasit user');

	const token = new Token({
		user: user.id,
		token: crypto.randomBytes(16).toString('hex')
	});

	try {
		await token.save();
	} catch (err) {
		res.status(500).json({ error: err });
	}

	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			type: 'OAuth2',
			user: process.env.GMAIL_USER,
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
			accessToken: accessToken
		}
	});

	const mailOptions = {
		from: process.env.GMAIL_USER,
		to: user.email,
		subject: 'Confirmare email',
		html: `<p>http://localhost:${process.env.PORT || 3333}/${token.token}</p>`
	};

	transporter.sendMail(mailOptions, err => {
		if (err) return res.send(500).json({ error: err });
		res.send(400).send('Email de confirmare trimis');
	});
});

module.exports = router;
