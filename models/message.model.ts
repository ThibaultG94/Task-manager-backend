import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  visitorModel: {
    type: Boolean,
    default: false,
    required: false,
},
});

// TTL index for visitor accounts
messageSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorMessage: true } // Applies only to documents where role is "visitor"
    }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;
