const Admin = require('../models/admin');
const router = require('express').Router();
const bcrypt = require('bcrypt');

router.post('/', async (req, res) => {
	try {
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(req.body.password, salt);

		const admin = new Admin({
			name: req.body.name,
			password: hashedPassword
		});

		await admin.save();
		res.status(200).json(admin);
	} catch (error) {
		return res.status(500).json(error);
	}
});

module.exports = router;
