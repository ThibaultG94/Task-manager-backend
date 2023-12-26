import mongoose from 'mongoose';

const tipSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
		},
		content: {
			type: String,
			required: true,
		},
		active: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

export default mongoose.model('tip', tipSchema);
