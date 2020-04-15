const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
	category: {
		type: Schema.Types.ObjectId,
		ref: 'Category'
	},
	name: {
		type: String,
		required: true
	},
	brand: {
		type: String,

		required: true
	},
	price: {
		type: Number,
		required: true
	},
	discountedPrice: { type: Number, default: null },
	imagesURL: {
		type: Array,
		required: true
	},
	informations: {
		type: {},
		required: true
	},
	reviews: [
		{
			type: Schema.Types.ObjectId,
			ref: 'Review',
			default: []
		}
	],
	questions: [
		{
			type: Schema.Types.ObjectId,
			ref: 'Question',
			default: []
		}
	],
	addedAt: { type: Date, default: Date.now },
	quantity: {
		type: Number,
		default: () => Math.floor(Math.random() * 1000) + 100
	}
});

module.exports = mongoose.model('Product', ProductSchema);
