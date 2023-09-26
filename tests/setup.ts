import mongoose, { MongooseError } from 'mongoose';
import logger from '../config/logger';

// Setting mongoose Promise to use Node.js native Promise
mongoose.Promise = Promise;

// Define the MongoDB URI
const mongoUri = 'mongodb://localhost:27017/tests/';

// Connect to the MongoDB instance
mongoose.connect(mongoUri);

// Log an error if there is one
mongoose.connection.on('error', (e: MongooseError) => {
	const error = e as any;
	if (error.code === 'ETIMEDOUT') {
		logger.error('ETIMEDOUT error occured', e);
		mongoose.connect(mongoUri);
	}
});

// Log a success message when the database connection is successfully established
mongoose.connection.once('open', () => {
	logger.info(`MongoDB successfully connected to ${mongoUri}`);
});

module.exports = mongoose;
