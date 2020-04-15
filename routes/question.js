const router = require('express').Router();
const User = require('../models/user').User;
const Question = require('../models/question');
const Product = require('../models/product');
const Answer = require('../models/answer');
const Admin = require('../models/admin');
const verifyToken = require('../middleware/verifyToken');
const { questionValidation } = require('../validation');

router.post('/:productName', verifyToken, async (req, res) => {
	const { error } = questionValidation(req.body);
	if (error) return res.status(500).json({ error });
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });

		const product = await Product.findOne({ name: req.params.productName });
		if (!product) return res.status(500).json({ error: 'Produsul nu a fost gasit' });

		const question = new Question({
			user: req.user.id,
			product: product._id,
			content: req.body.question
		});

		await question.save();
		product.questions.push(question);
		product.save();
		user.questions.push(question);
		user.save();
		return res.status(200).json({ ok: 'ok' });
	} catch (error) {
		return res.status(500).json({ error: error });
	}
});

router.post('/answer/:questionId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });

		if (!user) return res.status(401).json({ error: 'user not found' });

		const answer = new Answer({ content: req.body.answer, user });

		const question = await Question.findOne({ _id: req.params.questionId });
		question.answers.push(answer);

		await question.save();
		answer.user.firstName = user.firstName;
		answer.user.lastName = user.lastName;
		res.status(200).json({ questionId: question._id, answer });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/answer/:questionId/:answerId', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		await Question.updateOne({ _id: req.params.questionId }, { $pull: { answers: { _id: req.params.answerId } } });
		res.status(200).send('Answer deleted');
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/:id', async (req, res) => {
	const admin = await Admin.findOne({ _id: req.admin });
	if (!admin) return res.status(401).send('Acces denied');
	try {
		const question = await Question.findOne({ _id: req.params.id });
		if (!question) return res.status(404).send('Question not found');

		res.status(200).json(question);
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
		let orderBy = req.query.orderBy || '-createdAt';

		const questions = await Question.find({}).sort(orderBy).limit(limit).skip(page * limit);
		if (!questions) return res.status(404).send('Questions not found');
		const total = await Question.countDocuments({});

		res.status(200).json({ questions, total });
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
		let orderBy = req.query.orderBy || '-createdAt';

		const questions = await Question.find({ product: req.params.productId })
			.sort(orderBy)
			.limit(limit)
			.skip(page * limit);
		if (!questions) return res.status(404).send('Questions not found');
		const total = await Question.countDocuments({ product: req.params.productId });

		res.status(200).json({ questions, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const question = await Question.findOneAndRemove({ _id: req.params.id });

		await User.updateOne(
			{ _id: question.user },
			{
				$pull: {
					questions: req.params.id
				}
			}
		);
		await Product.updateOne(
			{ _id: question.product },
			{
				$pull: {
					questions: req.params.id
				}
			}
		);
		const total = await Question.countDocuments({});

		res.status(200).json({ total });
	} catch (error) {
		res.status(500).json(error);
	}
});

module.exports = router;
