const ProductInformation = require('../models/productInformation');
const router = require('express').Router();

router.get('/:type', async (req, res) => {
	try {
		const productInformation = await ProductInformation.findOne({ type: req.params.type }).populate('products');
		if (!productInformation) return res.status(404).send('Not found');
		res.status(200).json(productInformation.products);
	} catch (error) {
		console.log(error);
		return res.status(500).json(error);
	}
});

router.post('/:type', async (req, res) => {
	try {
		const info = new ProductInformation({
			type: req.params.type
		});
		await info.save();
		res.send('ok');
	} catch (error) {}
});

module.exports = router;
