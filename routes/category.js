const router = require('express').Router();
const Category = require('../models/category');
const verifyToken = require('../middleware/verifyToken');
const Admin = require('../models/admin');

router.get('/:categoryName', async (req, res) => {
	try {
		const category = await Category.findOne({ name: req.params.categoryName }).populate({
			path: 'products',
			populate: {
				path: 'reviews',
				select: 'rating review',
			},
		});
		if (!category) return res.status(404).send('Category not found');

		res.status(200).json(category);
	} catch (error) {
		console.log(error);
		res.status(500).json(error);
	}
});

router.get('/', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const categories = await Category.find({}).select('name');
		if (!categories) return res.status(404).send('Products not found');

		res.status(200).json(categories);
	} catch (error) {
		res.status(500).json(error);
	}
});

module.exports = router;
