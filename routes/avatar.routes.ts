import express from 'express';
import cloudinary from 'cloudinary';
import { auth } from '../middlewares/auth.middlewares';
const router = express.Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/signature', auth, async (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const params = {
    timestamp: timestamp
  };
  const signature = cloudinary.v2.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

  res.json({ signature, timestamp });
});

export default router;
