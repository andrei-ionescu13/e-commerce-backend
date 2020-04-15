const router = require('express').Router();
const User = require('../models/user').User;
const DeliveryData = require('../models/user').DeliveryData;
const Product = require('../models/product');
const Order = require('../models/order');
const Admin = require('../models/admin');
const verifyToken = require('../middleware/verifyToken');
const nodemailer = require('nodemailer');
const accessToken = require('../googleAcces');
const mongoose = require('mongoose');

router.post('/', verifyToken, async (req, res) => {
	try {
		const user = await User.findOne({ _id: req.user.id }).populate('cart.products.product');
		if (!user) return res.status(401).send('user not found');

		for (let index = 0; index < user.cart.products.length; index++) {
			if (user.cart.products[index].product.quantity < 1) {
				{
					return res
						.status(403)
						.json({ error: `${user.cart.products[index].product.name} nu mai este valabil` });
				}
			} else if (user.cart.products[index].quantity > user.cart.products[index].product.quantity) {
				return res.status(403).json({
					error: `Puteti adauga maxim ${user.cart.products[index].product.quantity} bucati de ${user.cart
						.products[index].product.name}`
				});
			}
		}

		const promises = [];

		user.cart.products.forEach((x) => {
			promises.push(
				Product.findOneAndUpdate(
					{ _id: x.product._id },
					{ $set: { quantity: x.product.quantity - x.quantity } }
				)
			);
		});
		await Promise.all(promises);

		const deliveryData = new DeliveryData({
			...req.body.deliveryData
		});

		const billingData = new DeliveryData({
			...req.body.billingData
		});

		const _id = mongoose.Types.ObjectId();
		const order = new Order({
			_id,
			orderNumber: _id.toString(),
			products: user.cart.products,
			totalPrice: user.cart.totalPrice,
			totalQuantity: user.cart.totalQuantity,
			user: user._id,
			deliveryData,
			billingData,
			paymentMethod: req.body.paymentMethod,
			observation: req.body.observation
		});

		await order.save();

		user.orders.push(order);
		user.cart = {
			totalPrice: 0,
			totalQuantity: 0,
			products: []
		};
		await user.save();

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
			subject: 'Inregistrare comanda',
			html: `<p>Comanda dvs . cu numarul <a href="http://localhost:3000/orders/${order._id}">${order._id}</a> a fost inregistrata</p>`
		};

		transporter.sendMail(mailOptions);

		res.status(200).json(user.cart);
	} catch (error) {
		res.send(500).json(error);
	}
});

router.put('/status/:id/:type', verifyToken, async (req, res) => {
	const admin = await Admin.findOne({ _id: req.admin });
	if (!admin) return res.status(401).send('Acces denied');
	try {
		const order = await Order.findOne({ _id: req.params.id });
		if (!order) return res.status(404).send('Order not found');

		order.status = req.params.type;
		await order.save();
		res.send(200).json(order);
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
		const status = req.query.status || '';
		const keyword = req.query.keyword || '';

		const fields = {};
		if (status !== '') fields.status = status;

		const orders = await Order.find({
			$and: [ fields, { orderNumber: { $regex: keyword, $options: 'i' } } ]
		})
			.sort(orderBy)
			.limit(limit)
			.skip(page * limit);
		if (!orders) return res.status(404).send('Orders not found');

		const total = await Order.countDocuments({
			$and: [ fields, { orderNumber: { $regex: keyword, $options: 'i' } } ]
		});
		res.status(200).json({ orders, total });
	} catch (error) {
		res.status(500).json(error);
	}
});

router.get('/:id', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const order = await Order.findOne({ _id: req.params.id });

		if (!order) return res.status(404).send('Orders not found');
		res.status(200).json(order);
	} catch (error) {
		console.log(error);
		res.status(500).json(error);
	}
});

router.put('/:id/status', verifyToken, async (req, res) => {
	try {
		const admin = await Admin.findOne({ _id: req.admin });
		if (!admin) return res.status(401).send('Acces denied');

		const order = await Order.findOne({ _id: req.params.id });
		if (!order) return res.status(404).send('Order not found');

		const user = await User.findOne({ orders: req.params.id });
		if (!user) return res.status(404).send('User not found');

		const sendMail = (html, subject) => {
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
				subject: subject,
				html: html
			};

			transporter.sendMail(mailOptions);
		};

		const status = req.body.status;

		let html,
			subject,
			orderProductIds,
			products,
			promises = [];

		switch (status) {
			case 'active':
				order.status = status;
				await order.save();
				html = `<p>Comanda dvs . cu numarul <a href="http://localhost:3000/orders/${order._id}">${order._id}</a> a fost confirmata</p>`;
				subject = 'Confirmare comanda';
				sendMail(html, subject);
				break;

			case 'finished':
				order.status = status;
				await order.save();

				res.status(200).send(`status changed in ${status}`);
				break;

			case 'canceled':
				orderProductIds = order.products.map((x) => x.product._id);
				products = await Product.find({ _id: { $in: orderProductIds } });

				promises = [];

				products.forEach((product) => {
					product.quantity =
						product.quantity +
						order.products.find((x) => x.product._id.toString() === product._id.toString()).quantity;
					promises.push(product.save());
				});

				await Promise.all(promises);

				order.status = status;
				await order.save();
				html = `<p>Comanda dvs . cu numarul <a href="http://localhost:3000/orders/${order._id}">${order._id}</a> a fost anulata</p>`;
				subject = 'Anulare comanda';
				sendMail(html, subject);
				res.status(200).send(`status changed in ${status}`);
				break;

			case 'refunded':
				orderProductIds = order.products.map((x) => x.product._id);
				products = await Product.find({ _id: { $in: orderProductIds } });

				promises = [];

				products.forEach((product) => {
					product.quantity =
						product.quantity +
						order.products.find((x) => x.product._id.toString() === product._id.toString()).quantity;
					promises.push(product.save());
				});

				await Promise.all(promises);

				order.status = status;
				await order.save();

				res.status(200).send(`status changed in ${status}`);
				break;
			default:
				break;
		}
	} catch (error) {
		res.status(500).json(error);
	}
});

module.exports = router;
