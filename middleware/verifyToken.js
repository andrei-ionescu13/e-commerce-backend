const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
	let token = req.header('Authorization');
	if (!token) return res.status(401).send('Acces denied');
	try {
		token = token.split(' ')[1];
		const verified = jwt.verify(token, process.env.TOKEN_SECRET);

		if (verified.admin) req.admin = verified.id;
		else req.user = verified;

		next();
	} catch (err) {
		res.status(401).send('Invalid token');
	}
};
