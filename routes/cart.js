const router = require('express').Router;
const Cart = require('../models/cart');
const User = require('../models/user');
const Product = require('../models/product');
const verifyToken = require('../middleware/verifyToken');

router.post('/:productId', verifyToken, async (req, res) => {
	const user = await User.findOne({ _id: req.user.id });
	if (!user) return res.status(401).send('user not found');

	const product = await Product.findOne({ _id: req.params.productId });
	if (!product) return res.status(404).send('product not found');
});
