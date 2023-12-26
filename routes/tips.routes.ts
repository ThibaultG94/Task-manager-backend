import express from 'express';
import { createTip, getTips } from '../controllers/tips.controller';
import { auth } from '../middlewares/auth.middlewares';

const router = express.Router();

router.post('/create-tip/:superadminId', auth, createTip);
router.get('/get-tips', getTips);

export default router;
