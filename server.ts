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
import workspaceRoutes from './routes/workspace.routes';
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
import jwt from 'jsonwebtoken';
import { Socket, UserPayload } from "./types/types";
import cleanupVisitors from './utils/cleanupVisitors';

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

const notificationNamespace = io.of('/notifications');
const messageNamespace = io.of('/messages');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

app.get('/', function rootHandler(req, res) {
  res.end('Hello world!');
});

app.get('/debug-centry', function mainHandler(req, res) {
  res.status(500);
  throw new Error('My first Sentry error!');
});

app.use(
  Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      if (error.status === 404 || error.status === 500) {
        return true;
      }
      return false;
    },
  })
);

app.use(function onError(req, res, next) {
  res.statusCode = 500;
  res.end(res + '\n');
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Middleware for socket authentication
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.user = decoded as UserPayload;
      next();
    });
  } else {
    next(new Error("Authentication error"));
  }
});

notificationNamespace.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.user = decoded as UserPayload;
      next();
    });
  } else {
    next(new Error("Authentication error"));
  }
});

notificationNamespace.on('connection', (socket: Socket) => {
  if (socket.user) {
    console.log("Notification socket connected:", socket.user.username);
    socket.join(socket.user._id);
  } else {
    console.log("A connection attempt was made without authentication");
  }

  socket.on('disconnect', () => {
    console.log('Notification user disconnected');
  });
});

// Middleware for message namespace
messageNamespace.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.user = decoded as UserPayload;
      next();
    });
  } else {
    next(new Error("Authentication error"));
  }
});

messageNamespace.on('connection', (socket: Socket) => {
  if (socket.user) {
    console.log("Message socket connected:", socket.user.username);
    socket.join(socket.user._id);
  } else {
    console.log("A connection attempt was made without authentication");
  }

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Launch server
server.listen(port, () => {
  logger.info('Le serveur a démarré au port ' + port)
});

export { notificationNamespace, messageNamespace };