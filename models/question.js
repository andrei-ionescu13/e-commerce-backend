const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnswerSchema = require('./answer').schema;

const QuestionSchema = new Schema({
	user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
	product: { type: mongoose.Types.ObjectId, ref: 'Product', required: true },
	content: { type: String, required: true },
	answers: { type: [ AnswerSchema ], default: [] },
	createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', QuestionSchema);
