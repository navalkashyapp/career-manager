import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    const envEmails = process.env.ALLOWED_EMAILS
      ? process.env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase())
      : [];
    const defaultAllowed = ['kashyapnaval35@gmail.com', 'navalkashyaap@gmail.com'];
    const allowedEmails = envEmails.length > 0 ? envEmails : defaultAllowed;

    const userEmail = (decodedToken.email || '').toLowerCase();
    if (!allowedEmails.includes(userEmail)) {
      return res.status(403).json({ error: 'Forbidden: Email not authorized' });
    }

    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('[authMiddleware] Token verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
