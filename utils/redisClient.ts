import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from '../config/logger';

dotenv.config();

const client = createClient({
	password: process.env.REDIS_PASSWORD,
	socket: {
		host: process.env.REDIS_HOST,
		port: 17149,
	},
	legacyMode: true,
});

const connectClient = async () => {
	try {
		await client.connect();
	} catch (err) {
		console.error('Error connecting to Redis:', err);
	}
};

connectClient();

client.on('connect', async () => await logger.info('Connected to Redis'));

client.on(
	'error',
	async (err) => await logger.error('Redis Client Error', err)
);

export default client;
