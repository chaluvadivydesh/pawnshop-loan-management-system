import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

const idempotencyCache = new Map<string, CachedResponse>();
const EXPIRATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup of expired idempotency keys
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyCache.entries()) {
    if (now - val.timestamp > EXPIRATION_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, 60 * 1000);

export function checkIdempotency(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey || req.method === 'GET') {
    return next();
  }

  const cached = idempotencyCache.get(idempotencyKey);
  if (cached && Date.now() - cached.timestamp < EXPIRATION_TTL_MS) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    return res.status(cached.statusCode).json(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyCache.set(idempotencyKey, {
        statusCode: res.statusCode,
        body,
        timestamp: Date.now()
      });
    }
    return originalJson(body);
  };

  next();
}
