const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tokenSchema = new Schema({
	user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
	token: { type: String, required: true },
	type: { type: String, required: true },
	createdAt: { type: Date, required: true, default: Date.now, expires: 86400 }
});

module.exports = mongoose.model('Token', tokenSchema);
