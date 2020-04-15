const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReviewSchema = new Schema({
	user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
	product: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
	rating: {
		type: Number,
		required: true
	},
	review: { type: String, required: true },
	createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);
