import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import { addComment, addReply, getCommentsByTaskId } from '../controllers/comments.controller';

const router = express.Router();

router.post('/comment', auth, addComment);
router.post('/comment/reply', auth, addReply);
router.get('/task/:taskId/comments', auth, getCommentsByTaskId);

export default router;
