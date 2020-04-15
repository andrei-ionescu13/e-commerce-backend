const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CartSchema = new Schema({
	items: [
		{
			item: {
				type: Schema.Types.ObjectId,
				ref: 'Product'
			},
			quantity: {
				type: Number,
				default: 1
			},
			default: []
		}
	],
	totalPrice: {
		type: Number,
		default: 0
	},
	deliveryFee: { type: Number, default: 18 }
});

module.exports = mongoose.model('Cart', CartSchema);
