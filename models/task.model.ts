import mongoose from 'mongoose';

// Defines the Task schema for MongoDB
const taskSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		userId: {
			type: String,
			required: true,
		},
		date: {
			type: Number,
			required: false,
		},
		description: {
			type: String,
			required: false,
		},
		status: {
			type: String,
			enum: ['Pending', 'In Progress', 'Completed', 'Archived'],
			default: 'Pending',
		},
		estimatedTime: {
			type: Number,
			required: false,
		},
		comments: {
			type: String,
			required: false,
		},
		priority: {
			type: String,
			enum: ['Low', 'Medium', 'High', 'Urgent'],
			default: 'Medium',
			required: false,
		},
		workspaceId: {
			type: String,
			required: true,
		},
		deadline: {
			type: String,
			required: false,
		},
		assignedTo: {
			type: [String],
			required: true,
		},
		archiveDate: {
			type: String,
			required: false,
			default: null,
		},
		visitorTask: {
			type: Boolean,
			default: false,
			required: false,
		},
	},
	// Add creation and update timestamps to each document
	{ timestamps: true }
);

// TTL index for visitor accounts
taskSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorTask: true } // Applies only to documents where role is "visitor"
    }
);

// Indexing userId for  query efficiency
taskSchema.index({ userId: 1 });

export default mongoose.model('task', taskSchema);
