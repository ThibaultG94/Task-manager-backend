import mongoose from 'mongoose';
import logger from './logger';

/**
 * Etablishes a connection with the MongoDB database.
 * The function will attempt to connect to a test database if the environment variable
 * NODE_ENV is set to 'test'. Otherwise, it will attempt to connect to the development database.
 */

export const connectDB = async () => {
	try {
		// Determine the correct database to connect to.
		const dbConnection: string =
			process.env.NODE_ENV === 'test'
				? process.env.TEST_MONGO_URI
				: process.env.MONGO_URI;

		// Attempt to connect to the database.
		await mongoose.connect(dbConnection);

		// Log the successful connection and the current state of development.
		logger.info(`Succesfully connected to MongoDB`);
		logger.info(
			`Etat : ${process.env.NODE_ENV === 'test' ? 'test' : 'development'}`
		);
	} catch (err) {
		// If the connection attempt failed, log the error.
		const result = (err as Error).message;
		console.error('Error connecting to MongoDB', result);

		// Exit the process with a failure code.
		process.exit(1);
	}
};
