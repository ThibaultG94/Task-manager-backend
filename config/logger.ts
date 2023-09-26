import winston from 'winston';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
	defaultMeta: { service: 'task-manager-service' },
	transports: [
		new winston.transports.File({
			filename: './backend/logs/error.log',
			level: 'error',
		}),
		new winston.transports.File({
			filename: './backend/logs/combined.log',
		}),
	],
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(
		new winston.transports.Console({
			format: winston.format.simple(),
		})
	);
}

export default logger;
