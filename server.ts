import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db';
import dotenv from 'dotenv';
import cors from 'cors';
import './utils/redisClient';
import * as Sentry from '@sentry/node';
import taskRoutes from './routes/task.routes';
import userRoutes from './routes/user.routes';
import workspaceRoutes from './routes/worskpace.routes';
import invitationRoutes from './routes/invitation.routes';
import workspaceInvitationRoutes from './routes/workspaceInvitation.routes';
import tipRoutes from './routes/tips.routes';
import notificationRoutes from './routes/notification.routes';
import commentsRoutes from './routes/comments.routes';
import conversationRoutes from './routes/conversations.routes';
import messagesRoutes from './routes/messages.routes';
import { apiLimiter } from './middlewares/rateLimiter.middlewares';
import cookieParser from 'cookie-parser';
import logger from './config/logger';
import Message from './models/message.model';
import cleanupVisitors from './utils/cleanupVisitors';
import Conversation from './models/conversation.model';

const port: number = 5000;

dotenv.config();

connectDB();

export const app = express();

// Create an HTTP server and configure it with Socket.io
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://127.0.0.1:3000', process.env.FRONTEND_URL],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS configuration
app.use(
	cors({
		origin: ['http://127.0.0.1:3000', process.env.FRONTEND_URL],
		credentials: true,
		optionsSuccessStatus: 200,
	})
);

// Middlewares for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(apiLimiter);

app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/invitations', invitationRoutes);
app.use('/workspaceInvitations', workspaceInvitationRoutes);
app.use('/tips', tipRoutes);
app.use('/notifications', notificationRoutes);
app.use('/comments', commentsRoutes);
app.use('/conversations', conversationRoutes);
app.use('/messages', messagesRoutes);

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	integrations: [
		// enable HTTP calls tracing
		new Sentry.Integrations.Http({ tracing: true }),
		// enable Express.js middleware tracing
		new Sentry.Integrations.Express({ app }),
		// Automatically instrument Node.js libraries and frameworks
		...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
	],

	// Set tracesSampleRate to 1.0 to capture 100%
	// of transactions for performance monitoring.
	// We recommend adjusting this value in production
	tracesSampleRate: 1.0,
});

// RequestHandler creates a separate execution context, so that all
// transactions/spans/breadcrumbs are isolated across requests
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

// All controllers should live here
app.get('/', function rootHandler(req, res) {
	res.end('Hello world!');
});

// Sentry.captureException(new Error('test exception'));

app.get('/debug-centry', function mainHandler(req, res) {
	res.status(500);
	throw new Error('My first Sentry error!');
});

// The error handler must be before any other error middleware and after all controllers
app.use(
	Sentry.Handlers.errorHandler({
		shouldHandleError(error) {
			// Capture all 404 and 500 errors
			if (error.status === 404 || error.status === 500) {
				return true;
			}
			return false;
		},
	})
);

app.use(function onError(req, res, next) {
	// The error id is attached to `res.sentry` to be returned
	// and optionally displayed to the user for support.
	res.statusCode = 500;
	res.end(res + '\n');
});

app.use((req, res, next) => {
	logger.info(`${req.method} ${req.url}`);
	next();
});

// Socket.io connection
io.on('connection', (socket) => {
	console.log('a user connected');

	// Load existing messages
	Message.find().then(messages => {
		socket.emit('init', messages);
	  });
  
	socket.on('disconnect', () => {
	  console.log('user disconnected');
	});
  
	socket.on('send_message', async (data) => {
	  const { user, message, conversationId } = data;
	  const newMessage = new Message({
		user,
		message,
		timestamp: new Date(),
		conversationId,
	  });
  
	  await newMessage.save();

	  const conversation = await Conversation.findById(conversationId);
	  conversation.messages.push(newMessage._id.toString());
	  conversation.lastMessage = message;
	  await conversation.save();
  
	  io.to(conversationId).emit('receive_message', data);
	});

	socket.on('join_conversation', (conversationId) => {
		socket.join(conversationId);
	});
});

// Launch server
server.listen(port, () => {
	// cleanupVisitors();
	logger.info('Le serveur a démarré au port ' + port)
});
