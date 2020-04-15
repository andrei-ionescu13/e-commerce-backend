const router = require('express').Router();
const Product = require('../models/product');
const Question = require('../models/question');
const Admin = require('../models/admin');
const ProductInformation = require('../models/productInformation');
const User = require('../models/user').User;
const Category = require('../models/category');
const Review = require('../models/review');
const mongoose = require('mongoose');
const verifyToken = require('../middleware/verifyToken');
var multer = require('multer');

const storage = multer.diskStorage({
	destination: './public/images',
	filename: function(req, file, cb) {
		cb(null, 'IMAGE-' + Date.now() + path.extname(file.originalname));
	}
});

const upload = multer({
	storage: storage,
	limits: { fileSize: 1000000 }
}).array('file', 10);

router.get('/search/:keyword', async (req, res) => {
	let keyword = req.params.keyword;
	keyword = keyword.replace(/\s\s+/g, ' ').trim();
	const splitKeyword = keyword.split(' ');
	const query = [];

	splitKeyword.forEach(x => {
		query.push({ name: { $regex: new RegExp(x, 'i') } });
	});

	try {
		const products = await Product.find({ $and: query });
		if (!products) return res.status(404).send('Products not found');

		const filters = [ { pret: [ 50, 100, 200, 500, 1000, 1500, 2000, 3000, 4000, 5000 ] }, 'brand' ];
		res.status(200).json({ products, filters });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/productsByIds', async (req, res) => {
	const products = await Product.find({
		_id: {
			$in: req.body.productsIds
		}
	}).populate({
		path: 'reviews',
		select: 'review rating'
	});
	if (!products) return res.status(404).send('No products found');
	res.status(200).send(products);
});

router.get('/promotions', async (req, res) => {
	try {
		const result = await Product.find({ discountedPrice: { $ne: null } });
		const filters = [ { pret: [ 50, 100, 200, 500, 1000, 1500, 2000, 3000, 4000, 5000 ] }, 'brand' ];

		res.status(200).json({ products: result, filters });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/promotions/:limit', async (req, res) => {
	try {
		const result = await Product.find({ discountedPrice: { $ne: null } }).limit(parseInt(req.params.limit));

		res.status(200).json(result);
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/name/:productName', async (req, res) => {
	try {
		const productName = req.params.productName;
		const product = await Product.findOne({ name: productName })
			.populate({
				path: 'reviews',

				populate: {
					path: 'user',
					select: 'firstName lastName'
				}
			})
			.populate({
				path: 'questions',
				populate: [
					{
						path: 'user',
						select: 'firstName lastName'
					},
					{
						path: 'answers.user',
						select: 'firstName lastName'
					}
				]
			});

		res.status(200).json(product);
	} catch (error) {
		res.status(500).json({ error: error });
	}
});

router.delete('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		await Category.findOneAndUpdate({ products: req.params.id }, { $pull: { products: req.params.id } });

		const reviews = await Review.find({ product: req.params.id });
		await Review.deleteMany({ product: req.params.id });
		const questions = await Question.find({ product: req.params.id });
		await Question.deleteMany({ product: req.params.id });

		const reviewsIds = reviews.map(x => x._id.toString());
		const questionsIds = questions.map(x => x._id.toString());

		const users = await User.find({
			$or: [
				{ wishlist: req.params.id },
				{ 'cart.products.product': req.params.id },
				{
					reviews: { $in: reviewsIds }
				},
				{
					questions: { $in: questionsIds }
				}
			]
		}).populate({ path: 'cart.products.product' });

		const promises = [];
		const modifiedUsers = [];

		users.forEach(user => {
			user.wishlist = user.wishlist.filter(x => x != req.params.id);
			user.reviews = user.reviews.filter(x => !reviewsIds.includes(x.toString()));
			user.questions = user.questions.filter(x => !questionsIds.includes(x.toString()));

			user.cart.products = user.cart.products.filter(x => x.product._id != req.params.id);

			user.cart.totalPrice = user.cart.products.reduce(
				(total, x) => total + (x.product.discountedPrice || x.product.price) * x.quantity,
				0
			);
			user.cart.totalQuantity = user.cart.products.reduce((total, x) => total + x.quantity, 0);

			promises.push(user.save());
		});

		await Product.deleteOne({ _id: req.params.id });
		await Promise.all(promises);
		res.status(200).send('product deleted');
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});

router.get('/', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const category = req.query.category || '';
		const price = req.query.price || '';
		const page = parseInt(req.query.page) || 0;
		const limit = parseInt(req.query.limit) || 20;
		const orderBy = req.query.orderBy || '-createdAt';
		let keyword = req.query.keyword || '';
		keyword = keyword.replace(/\s\s+/g, ' ').trim();
		const splitKeyword = keyword.split(' ');
		const query = [];

		splitKeyword.forEach(x => {
			query.push({ $or: [ { name: { $regex: new RegExp(x, 'i') } } ] });
		});

		if (category !== '') {
			query.push({ category: category });
		}

		switch (price) {
			case '':
				break;
			case 'discounted':
				query.push({ discountedPrice: { $ne: null } });
				break;
			case 'not-discounted':
				query.push({ discountedPrice: null });
				break;
			default:
				break;
		}

		const products = await Product.find({ $and: query }).sort(orderBy).limit(limit).skip(page * limit).populate({
			path: 'category',
			select: 'name'
		});

		if (!products) return res.status(404).send('Products not found');

		const total = await Product.countDocuments({ $and: query });

		res.status(200).json({ products, total });
	} catch (error) {
		console.log(error);
		res.status(500).json(error);
	}
});

router.get('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const product = await Product.findOne({ _id: req.params.id }).populate({
			path: 'category',
			select: 'name'
		});
		if (!product) res.status(404).send('product not found');

		res.status(200).json(product);
	} catch (error) {
		console.log(error);
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

		let product = await Product.findOne({ _id: req.params.id });

		if (!product) return res.status(404).send('Product not found');

		const total = product.reviews.length;

		product = await Product.findOne({ _id: req.params.id }).populate({
			path: 'reviews',
			options: {
				limit: limit,
				skip: page * limit,
				sort: 'addedAt'
			}
		});

		console.log(product.reviews);

		res.status(200).json({ reviews: product.reviews, total });
	} catch (error) {
		console.log(error);
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

		let product = await Product.findOne({ _id: req.params.id });

		if (!product) return res.status(404).send('Product not found');

		const total = product.questions.length;

		product = await Product.findOne({ _id: req.params.id }).populate({
			path: 'questions',
			options: {
				sort: orderBy,
				limit: limit,
				skip: page * limit
			}
		});

		res.status(200).json({ questions: product.questions, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');
		const product = new Product({
			name: req.body.name,
			brand: req.body.name,
			price: req.body.price,
			quantity: req.body.quantity,
			discountedPrice: req.body.discountedPrice === '' ? null : req.body.discountedPrice,
			specifications: JSON.parse(req.body.specifications),
			name: req.body.name,
			category: req.body.category
		});
		await product.save();

		const category = await Category({ _id: product.category });
		category.products.push(product._id);
		await category.save();
		res.status(200).send('product created');
	} catch (error) {
		console.log(error);
		res.status(500).json(error);
	}
});

router.put('/:id', verifyToken, async (req, res) => {
	try {
		console.log('aici');
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const product = await Product.findOne({ _id: req.params.id });
		await Category.findByIdAndUpdate(product.category, {
			$pull: {
				products: { _id: product._id }
			}
		});

		product.name = req.body.name;
		product.price = req.body.price;
		product.discountedPrice = req.body.discountedPrice === '' ? null : req.body.discountedPrice;
		product.quantity = req.body.quantity;
		product.category = req.body.category;
		product.brand = req.body.brand;
		product.informations = JSON.parse(req.body.specifications);
		await product.save();
		const category = await Category.findOne({ _id: req.body.category });
		category.products.push();
		await category.save();
		res.status(200).send('modified');
	} catch (error) {
		res.status(500).json(error);
	}
});

router.post('/upload', verifyToken, async (req, res) => {
	upload(req, res, err => {
		console.log('Request ---', req.body);
		console.log('Request file ---', req.file); //Here you get file.
		/*Now do where ever you want to do*/
		if (!err) return res.send(200).end();
	});
});

module.exports = router;
