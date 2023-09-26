import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
	token: string;
	userId: Schema.Types.ObjectId;
}

const RefreshTokenSchema: Schema = new Schema({
	token: { type: String, required: true },
	userId: { type: Schema.Types.ObjectId, required: true },
});

export default mongoose.model<IRefreshToken>(
	'RefreshToken',
	RefreshTokenSchema
);
