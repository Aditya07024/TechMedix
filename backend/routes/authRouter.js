import express from 'express';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    const { code } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: code,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, name, picture } = ticket.getPayload();
    
    // Here you would typically:
    // 1. Check if user exists in your database
    // 2. Create new user if they don't exist
    // 3. Create a session or JWT token
    
    res.json({
      user: { email, name, picture },
      message: "Successfully authenticated with Google"
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

export default router;