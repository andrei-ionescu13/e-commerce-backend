const router = require('express').Router();
const Review = require('../models/review');
const User = require('../models/user').User;
const Product = require('../models/product');
const Admin = require('../models/admin');
const verifyToken = require('../middleware/verifyToken');
const { reviewValidation } = require('../validation');
const mongoose = require('mongoose');

router.post('/:productName', verifyToken, async (req, res) => {
	const { error } = reviewValidation(req.body);
	if (error) return res.status(500).json({ error });
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });

		const product = await Product.findOne({ name: req.params.productName });
		if (!product) return res.status(500).json({ error: 'product not found' });

		let review = await Review.findOne({
			user: user._id,
			product: product._id
		});

		if (review) return res.status(400).json({ error: 'Deja aveti un review pentru acest produs' });
		review = new Review({
			user: req.user.id,
			product: product._id,
			rating: req.body.rating,
			review: req.body.review
		});

		await review.save();
		product.reviews.push(review);
		product.save();
		user.reviews.push(review);
		user.save();
		return res.status(200).json({ ok: 'ok' });
	} catch (error) {
		return res.status(500).json({ error: error });
	}
});

router.get('/:id', verifyToken, async (req, res) => {
	const admin = await Admin.findOne({ _id: req.admin });
	if (!admin) return res.status(401).send('Acces denied');
	try {
		const review = await Review.findOne({ _id: req.params.id });
		if (!review) return res.status(404).send('Review not found');

		res.status(200).json(review);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		let page = parseInt(req.query.page) || 0;
		let limit = parseInt(req.query.limit) || 20;
		let orderBy = req.query.orderBy || 'createdAt';

		const reviews = await Review.find({}).sort(orderBy).limit(limit).skip(page * limit);
		if (!reviews) return res.status(404).send('Reviews not found');

		const total = await Review.countDocuments({});
		res.status(200).json({ reviews, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/product/:productId', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		let page = parseInt(req.query.page) || 0;
		let limit = parseInt(req.query.limit) || 20;
		let orderBy = req.query.orderBy || 'createdAt';

		const reviews = await Review.find({ product: req.params.productId })
			.sort(orderBy)
			.limit(limit)
			.skip(page * limit);
		if (!reviews) return res.status(404).send('Reviews not found');

		const total = await Review.countDocuments({ product: req.params.productId });
		res.status(200).json({ reviews, total });
	} catch (error) {
		console.log(error);
		res.status(500).json(error);
	}
});

router.delete('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const review = await Review.findOneAndRemove({ _id: req.params.id });

		await User.updateOne(
			{ _id: review.user },
			{
				$pull: {
					reviews: req.params.id
				}
			}
		);
		await Product.updateOne(
			{ _id: review.product },
			{
				$pull: {
					reviews: req.params.id
				}
			}
		);
		const total = await Review.countDocuments({});

		res.status(200).json({ total });
	} catch (error) {
		res.status(500).json(error);
	}
});

module.exports = router;
