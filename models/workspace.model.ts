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
				userId: String,
				username: String,
				email: String,
				role: {
					type: String,
					enum: ['admin', 'superadmin', 'member'],
					default: 'member',
				},
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
