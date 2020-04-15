const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeliveryDataSchema = new Schema({
	lastName: { type: String, required: true },
	firstName: { type: String, required: true },
	phone: { type: String, required: true },
	county: { type: String, required: true },
	city: { type: String, required: true },
	address: { type: String, required: true }
});

const CartProductSchema = new Schema({
	product: {
		type: Schema.Types.ObjectId,
		ref: 'Product'
	},
	quantity: {
		type: Number,
		default: 1
	}
});

const CartSchema = new Schema({
	products: {
		type: [ CartProductSchema ],
		default: []
	},
	totalPrice: {
		type: Number,
		default: 0
	},
	totalQuantity: {
		type: Number,
		default: 0
	},
	deliveryFee: { type: Number, default: 18 }
});

const UserSchema = new Schema({
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true, min: 8 },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	active: { type: Boolean, default: false },
	phone: { type: String, default: null },
	dateOfBirth: { type: Date, default: null },
	deliveryAddresses: { type: [ DeliveryDataSchema ], default: [] },
	wishlist: [ { type: Schema.Types.ObjectId, ref: 'Product', default: [] } ],
	reviews: [
		{
			type: Schema.Types.ObjectId,
			ref: 'Review',
			default: []
		}
	],
	cart: { type: CartSchema, default: {} },
	questions: [ { type: Schema.Types.ObjectId, ref: 'Question', default: [] } ],
	orders: [
		{
			type: Schema.Types.ObjectId,
			ref: 'Order',
			default: []
		}
	],
	createdAt: { type: Date, default: Date.now }
});

module.exports = {
	User: mongoose.model('User', UserSchema),
	DeliveryData: mongoose.model('DeliveryData', DeliveryDataSchema),
	Cart: mongoose.model('Cart', CartSchema),
	CartProduct: mongoose.model('CartProduct', CartProductSchema)
};
