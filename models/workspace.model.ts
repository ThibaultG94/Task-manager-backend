import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		userId: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		members: [
			{
				type: String,
				ref: 'User',
			},
		],
		isDefault: {
			type: String,
			default: false,
		},
		lastUpdateDate: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

workspaceSchema.index({ userId: 1 });

export default mongoose.model('workspace', workspaceSchema);
