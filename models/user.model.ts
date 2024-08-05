import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Define the schema for User model
const userSchema = new mongoose.Schema({
		username: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
			required: true,
		},
		role: {
			type: String,
			enum: ['user', 'admin', 'superadmin', 'visitor'],
			default: 'user',
		},
		tips: {
			type: Boolean,
			default: true,
		},
		resetPasswordToken: {
			type: String,
			default: null,
		},
		resetPasswordExpires: {
			type: Number,
			default: null,
		},
		contacts: {
			type: Array,
			default: [],
		}, 
		blocked: {
			type: Array,
			default: [],
		},
		avatar: {
			type: String,
			default: null,
		},
	},
	{ timestamps: true },
);

// TTL index for visitor accounts
userSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { role: "visitor" } // Applies only to documents where role is "visitor"
    }
);

// Before saving a user, hash the password
userSchema.pre('save', async function (next) {
	// Check if password field is modified
	if (!this.isModified('password')) {
		return next();
	}

	try {
		// Generate a salt and hash the password
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (err) {
		const result = err as Error;
		next(result);
	}
});

// Add a method to compare passwords
userSchema.methods.comparePasswords = async function (
	candidatePassword: string
) {
	return await bcrypt.compare(candidatePassword, this.password);
};

// Add a method to generate auth tokens
userSchema.methods.generateAuthToken = function () {
	const user = this;
	const token = jwt.sign(
		{
			_id: user._id.toHexString(),
			username: user.username,
			email: user.email,
			role: user.role,
		},
		process.env.JWT_SECRET as string,
		{
			expiresIn: process.env.JWT_EXPIRES_IN,
		}
	);
	return token;
};

userSchema.methods.generateRefreshToken = function () {
	const user = this;
	const refreshToken = jwt.sign(
		{ _id: user._id, email: user.email },
		process.env.REFRESH_TOKEN_SECRET,
		{
			expiresIn: '7d',
		}
	);
	return refreshToken;
};

export default mongoose.model('user', userSchema);
