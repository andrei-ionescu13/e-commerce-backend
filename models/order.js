const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ProductSchema = require('./product').schema;
const DeliveryDataSchema = require('./user').DeliveryData.schema;

const CartProductSchema = new Schema({
	product: {
		type: ProductSchema
	},
	quantity: {
		type: Number
	}
});

const OrderSchema = new Schema({
	_id: Schema.Types.ObjectId,
	orderNumber: {
		type: String,
		required: true
	},
	products: {
		type: [ CartProductSchema ],
		default: []
	},
	totalPrice: {
		type: Number
	},
	totalQuantity: {
		type: Number
	},
	status: {
		type: String,
		default: 'pending'
	},
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	deliveryData: { type: DeliveryDataSchema },
	billingData: { type: DeliveryDataSchema },
	paymentMethod: { type: String },
	createdAt: { type: Date, default: Date.now },
	observation: { type: String, default: '' },
	deliveryFee: { type: Number, default: 13 }
});

module.exports = mongoose.model('Order', OrderSchema);
