const router = require('express').Router();
const User = require('../models/user').User;
const DeliveryData = require('../models/user').DeliveryData;
const Cart = require('../models/user').Cart;
const CartProduct = require('../models/user').CartProduct;
const Product = require('../models/product');
const Review = require('../models/review');
const Token = require('../models/token');
const {
	signupValidation,
	logInValidation,
	recoveryValidation,
	resetValidation,
	userDataValidation
} = require('../validation');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const accessToken = require('../googleAcces');
const verifyToken = require('../middleware/verifyToken');
const ProductInformation = require('../models/productInformation');
const Admin = require('../models/admin');
const Question = require('../models/question');

router.post('/signin', async (req, res) => {
	try {
		const { error } = signupValidation(req.body);
		if (error) return res.status(401).json({ error: error.details[0].message });
		let user = await User.findOne({ email: req.body.email });
		if (user && user.active === true) return res.status(401).json({ error: 'Email existent' });

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(req.body.password, salt);

		if (!user) {
			user = new User({
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				email: req.body.email,
				password: hashedPassword
			});

			await user.save();
		}

		token = new Token({
			user: user.id,
			token: crypto.randomBytes(16).toString('hex'),
			type: 'authorization'
		});

		await token.save();

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
			html: `<p>Pentru a va activa contul accesati http://localhost:${process.env.PORT ||
				3333}/token/${token.token}</p>`
		};

		transporter.sendMail(mailOptions);
		res.status(200).send('Email de confirmare trimis');
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/login', async (req, res) => {
	try {
		let token = {};
		const admin = await Admin.findOne({ name: req.body.email });
		if (admin) {
			const validPassword = await bcrypt.compare(req.body.password, admin.password);
			if (validPassword) {
				token = jwt.sign({ id: admin._id, admin: true }, process.env.TOKEN_SECRET, {
					expiresIn: 30000
				});
				return res.json({ token, admin: true });
			}
		}

		const user = await User.findOne({ email: req.body.email });
		if (!user) return res.status(401).json({ error: 'Email sau parola incorecta' });

		const validPassword = await bcrypt.compare(req.body.password, user.password);
		if (!validPassword) return res.status(401).json({ error: 'Email sau parola incorecta' });

		if (!user.active) return res.status(401).json({ error: 'Contul nu este verificat' });

		token = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET, {
			expiresIn: 30000
		});

		res.json({ token });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/recovery', async (req, res) => {
	const { error } = recoveryValidation(req.body);
	if (error) return res.status(422).json({ error: error.details[0].message });

	const user = await User.findOne({ email: req.body.email });
	if (!user) return res.status(422).json({ error: 'Email incorect' });

	const token = new Token({
		user: user.id,
		token: crypto.randomBytes(16).toString('hex'),
		type: 'recovery'
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
		subject: 'Resetare parola',
		html: `<p>http://localhost:${process.env.PORT || 3333}/token/recovery/${token.token}</p>`
	};

	transporter.sendMail(mailOptions, (err) => {
		if (err) return res.status(500).json({ error: err });
		res.status(200).send('Email pentru resetarea parolei trimis');
	});
});

router.post('/reset/:token', async (req, res) => {
	const { error } = resetValidation(req.body);
	if (error) return res.status(422).send({ error: error.details[0].message });

	const token = await Token.findOne({ token: req.params.token });
	if (!token || token.type !== 'recovery') return res.status(400).json({ error: 'Nu s-a gasit un token valid' });

	const user = await User.findOne({ _id: token.user });
	if (!user) return res.status(400).json({ error: 'Nu s-a gasit user cu acest token' });

	const salt = await bcrypt.genSalt(10);
	const hashedPassword = await bcrypt.hash(req.body.password, salt);

	user.password = hashedPassword;
	try {
		await user.save();
		await Token.deleteOne({ _id: token._id });
		res.status(200).send('Schimbarea parolei a avut loc cu succes');
	} catch (err) {
		res.status(500).json({ error: err });
	}
});

router.delete('/review/:id', verifyToken, async (req, res) => {
	try {
		const review = await Review.findOneAndRemove({ _id: req.params.id });

		await User.findOneAndUpdate(
			{ _id: req.user.id },
			{
				$pull: {
					reviews: req.params.id
				}
			}
		);
		await Product.findOneAndUpdate(
			{ _id: review.product },
			{
				$pull: {
					reviews: req.params.id
				}
			}
		);

		res.status(200).json({ message: 'review deleted' });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/wishlist', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'User-ul nu exista' });

		if (user.wishlist.includes(req.body.productId))
			return res.status(405).json({ error: 'Produsul este deja in wishlist-ul dvs.' });
		user.wishlist.push(req.body.productId);
		const result = await user.save();

		const productInformation = await ProductInformation.findOne({ type: 'recently-wishlisted' });
		if (productInformation && !productInformation.products.includes(req.body.productId)) {
			if (productInformation.products.length > 23) {
				productInformation.products = productInformation.products.slice(
					productInformation.products.length - 23
				);
			}
			productInformation.products.push(req.body.productId);

			await productInformation.save();
		}

		res.status(200).json({ result });
	} catch (error) {
		console.log(error);

		res.status(500).json({ error });
	}
});

router.put('/wishlist', verifyToken, async (req, res) => {
	try {
		let user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });
		user.wishlist = user.wishlist.filter((x) => x != req.body.productId);
		res.send(await user.save());
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/wishlist', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('wishlist').select('wishlist');
		if (!user) return res.status(404).json({ error: 'User-ul nu exista' });

		res.status(200).json(user.wishlist);
	} catch (error) {
		res.status(500).json({ error });
	}
});

router.get('/reviews', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate({
			path: 'reviews',
			populate: {
				path: 'product',
				select: 'name imagesURL'
			}
		});

		if (!user) return res.status(404).json({ error: 'User-ul nu exista' });
		res.status(200).json(user.reviews);
	} catch (error) {
		res.status(500).json({ error });
	}
});

router.get('/questions', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate({
			path: 'questions',
			populate: {
				path: 'product',
				select: 'name imagesURL'
			}
		});

		if (!user) return res.status(404).json({ error: 'User-ul nu exista' });

		res.status(200).json(user.questions);
	} catch (error) {
		res.status(500).json({ error });
	}
});

router.post('/data', verifyToken, async (req, res) => {
	const { error } = userDataValidation(req.body);
	if (error) {
		return res.status(422).json({ error: error.details[0].message });
	}
	try {
		const user = await User.findOne(
			{ _id: req.user.id },
			{
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				phone: req.body.phone
			}
		);
		if (!user) return res.status(404).json({ error: 'User-ul nu exista' });
		user.firstName = req.body.firstName;
		user.lastName = req.body.lastName;
		user.phone = req.body.phone;
		if (req.body.dateOfBirth) user.dateOfBirth = req.body.dateOfBirth;
		user.save();
		res.status(200).json(user);
	} catch (error) {
		res.status(500).json({ error });
	}
});

router.get('/data', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });
		res.status(200).json(user);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/address', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });
		const deliveryAddress = new DeliveryData({
			lastName: req.body.lastName,
			firstName: req.body.firstName,
			phone: req.body.phone,
			county: req.body.county,
			city: req.body.city,
			address: req.body.address
		});

		if (user.phone === null) user.phone = req.body.phone;
		user.deliveryAddresses.push(deliveryAddress);
		await user.save();
		res.status(200).json(deliveryAddress);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.put('/address', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });
		const deliveryAddress = user.deliveryAddresses.find((x) => x._id == req.body.id);
		deliveryAddress.lastName = req.body.lastName;
		deliveryAddress.firstName = req.body.firstName;
		deliveryAddress.phone = req.body.phone;
		deliveryAddress.county = req.body.county;
		deliveryAddress.city = req.body.city;
		deliveryAddress.address = req.body.address;
		await user.save();
		res.status(200).json(deliveryAddress);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/address/:id', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(404).json({ error: 'user not found' });

		user.deliveryAddresses = user.deliveryAddresses.filter((x) => x._id != req.params.id);
		await user.save();
		res.status(200).json({ id: req.params.id });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/cart', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).json({ error: 'user not found' });
		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/cart/:productId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');

		let product;
		product = user.cart.products.find((x) => x.product._id == req.params.productId);
		if (product) return res.status(405).json({ error: 'Produsul se afla in cosul dvs.' });

		product = await Product.findOne({ _id: req.params.productId });
		if (!product) return res.status(404).send('product not found');

		const cartProduct = new CartProduct({
			product
		});

		user.cart.products.push(cartProduct);

		user.cart.totalPrice = user.cart.products.reduce(
			(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
			0
		);
		user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

		await user.save();

		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/cart/:productId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');

		user.cart.products = user.cart.products.filter((x) => x.product._id !== req.params.productId);

		user.cart.totalPrice = user.cart.products.reduce(
			(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
			0
		);

		user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

		await user.save();
		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.put('/cart/quantity/:productId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');

		const productIndex = user.cart.products.findIndex((x) => x.product._id === req.params.productId);
		user.cart.products[productIndex].quantity = req.body.quantity;

		user.cart.totalPrice = user.cart.products.reduce(
			(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
			0
		);
		user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

		await user.save();
		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/cart/product/:productId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');
		user.cart.products = user.cart.products.filter((x) => x.product._id != req.params.productId);

		user.cart.totalPrice = user.cart.products.reduce(
			(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
			0
		);
		user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

		await user.save();
		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.put('/cart/product/quantity/:productId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');
		const itemIndex = user.cart.products.findIndex((x) => x.product._id == req.params.productId);

		user.cart.products[itemIndex].quantity = req.body.quantity;

		user.cart.totalPrice = user.cart.products.reduce(
			(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
			0
		);

		user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

		await user.save();
		res.status(200).json(user.cart);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/orders', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate(
			'orders',
			'status totalPrice totalQuantity createdAt'
		);

		if (!user) return res.status(401).send('user not found');
		res.status(200).json(user.orders);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/order/:id', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('orders');
		if (!user) return res.status(401).send('user not found');

		const orderIndex = user.orders.findIndex((x) => x._id == req.params.id);
		if (orderIndex === -1) return res.status(401).send('forbidden');
		res.status(200).json(user.orders[orderIndex]);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/:id/reviews', verifyToken, async (req, res) => {
	try {
		let page = parseInt(req.query.page) || 0;
		let limit = req.query.limit || 20;
		let orderBy = req.query.orderBy || '-createdAt';

		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		let user = await User.findOne({ _id: req.params.id });

		if (!user) return res.status(404).send('User not found');

		const total = user.reviews.length;

		user = await User.findOne({ _id: req.params.id }).populate({
			path: 'reviews',
			options: {
				sort: orderBy,
				limit: limit,
				skip: page * limit
			}
		});

		console.log(user.reviews);

		res.status(200).json({ reviews: user.reviews, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/:id/questions', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		let page = parseInt(req.query.page) || 0;
		let limit = req.query.limit || 20;
		let orderBy = req.query.orderBy || '-createdAt';

		let user = await User.findOne({ _id: req.params.id });

		if (!user) return res.status(404).send('User not found');

		const total = user.questions.length;

		user = await User.findOne({ _id: req.params.id }).populate({
			path: 'questions',
			options: {
				sort: orderBy,
				limit: limit,
				skip: page * limit
			}
		});

		res.status(200).json({ questions: user.questions, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const reviews = await Review.find({ user: req.params.id });
		await Review.deleteMany({ user: req.params.id });

		const questions = await Question.find({ user: req.params.id });
		await Question.deleteMany({ user: req.params.id });

		const reviewsIds = reviews.map((x) => x._id.toString());
		const questionsIds = questions.map((x) => x._id.toString());

		const products = await Product.find({
			$or: [
				{
					reviews: { $in: reviewsIds }
				},
				{
					questions: { $in: questionsIds }
				}
			]
		});

		const promises = [];
		const modifiedProducts = [];

		products.forEach((product) => {
			product.reviews = product.reviews.filter((x) => !reviewsIds.includes(x.toString()));
			product.questions = product.questions.filter((x) => !questionsIds.includes(x.toString()));

			modifiedProducts.push(product);
		});

		modifiedProducts.forEach((modifiedProduct) => {
			promises.push(modifiedProduct.save());
		});

		await User.deleteOne({ _id: req.params.id });
		await Promise.all(promises);

		const total = await User.countDocuments({});

		res.status(200).json(total);
	} catch (error) {
		res.status(500).send(error);
	}
});

router.delete('/review/:id', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(401).send('user not found');

		const review = await Review.findOneAndRemove({ _id: req.params.id });

		await Product.updateOne(
			{ _id: review.product },
			{
				$pull: {
					reviews: req.params.id
				}
			}
		);

		user.reviews = user.reviews.filter((x) => x._id != req.params.id);
		await user.save();
		res.status(200).send('review deleted');
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/question/:id', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(401).send('user not found');

		const question = await Question.findOneAndRemove({ _id: req.params.id });

		await Product.updateOne(
			{ _id: question.product },
			{
				$pull: {
					questions: req.params.id
				}
			}
		);

		user.questions = user.questions.filter((x) => x._id != req.params.id);
		await user.save();
		res.status(200).send('question deleted');
	} catch (error) {
		res.status(500).json(error);
	}
});

router.delete('/answer/:questionId/:answerId', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id });
		if (!user) return res.status(401).json({ error: 'user not found' });

		await Question.updateOne({ _id: req.params.questionId }, { $pull: { answers: { _id: req.params.answerId } } });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const page = parseInt(req.query.page) || 0;
		const limit = parseInt(req.query.limit) || 20;
		const orderBy = req.query.orderBy || '-createdAt';
		const keyword = req.query.keyword || '';

		const users = await User.find({ email: { $regex: keyword, $options: 'i' } })
			.populate({
				path: 'orders',
				options: {
					sort: orderBy
				}
			})
			.sort(orderBy)
			.limit(limit)
			.skip(page * limit);

		if (!users) return res.status(404).send('User not found');
		const total = await User.countDocuments({ email: { $regex: keyword, $options: 'i' } });

		res.status(200).json({ users, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const user = await User.findOne({ _id: req.params.id }).populate({
			path: 'orders',
			options: {
				sort: '-createdAt'
			}
		});

		if (!user) return res.status(404).send('User not found');

		res.status(200).json(user);
	} catch (error) {
		res.status(500).json(error);
	}
});

module.exports = router;
