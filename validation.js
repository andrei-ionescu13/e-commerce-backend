const Joi = require('@hapi/joi');

module.exports.signupValidation = data => {
	const schema = Joi.object({
		firstName: Joi.string().required(),
		lastName: Joi.string().required(),
		email: Joi.string().email().required(),
		password: Joi.string().required().min(8).regex(/(?=.*[A-Z])/).regex(/(?=.*[0-9])/),
		confirmedPassword: Joi.string().required().equal(Joi.ref('password'))
	});

	return schema.validate(data);
};

module.exports.logInValidation = data => {
	const schema = Joi.object({
		email: Joi.string().email().required(),
		password: Joi.string().required().min(8).regex(/(?=.*[A-Z])/).regex(/(?=.*[0-9])/)
	});
	return schema.validate(data);
};

module.exports.recoveryValidation = data => {
	const schema = Joi.object({
		email: Joi.string().email().required()
	});

	return schema.validate(data);
};

module.exports.resetValidation = data => {
	const schema = Joi.object({
		password: Joi.string().required().min(8).regex(/(?=.*[A-Z])/).regex(/(?=.*[0-9])/),
		confirmedPassword: Joi.string().required().equal(Joi.ref('password'))
	});

	return schema.validate(data);
};

module.exports.reviewValidation = data => {
	const schema = Joi.object({
		rating: Joi.number().required().min(1),
		review: Joi.string().required().min(20).max(255)
	});

	return schema.validate(data);
};

module.exports.questionValidation = data => {
	const schema = Joi.object({
		question: Joi.string().required().max(255)
	});

	return schema.validate(data);
};

module.exports.answerValidation = data => {
	const schema = Joi.object({
		question: Joi.string().required().max(255)
	});

	return schema.validate(data);
};

module.exports.userDataValidation = data => {
	const schema = Joi.object({
		firstName: Joi.string().required(),
		lastName: Joi.string().required(),
		phone: Joi.string()
			.regex(
				/^((\\+[1-9]{1,4}[ \\-]*)|(\\([0-9]{2,3}\\)[ \\-]*)|([0-9]{2,4})[ \\-]*)*?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/
			)
			.required(),
		dateOfBirth: Joi.date().allow(null)
	});

	return schema.validate(data);
};
