import Joi from 'joi';

export const registerSchema = Joi.object({
	username: Joi.string().alphanum().min(3).max(30).required(),
	email: Joi.string().min(6).email().required().max(254),
	password: Joi.string().min(8).required().max(128),
	role: Joi.string().valid('user', 'admin', 'superadmin').required(),
});

export const loginSchema = Joi.object({
	email: Joi.string().min(6).required().email().max(254),
	password: Joi.string().min(8).required().max(128),
});

export const forgetSchema = Joi.object({
	email: Joi.string().min(6).required().email().max(254),
});
