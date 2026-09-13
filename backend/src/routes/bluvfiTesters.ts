import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, TesterRole, TesterStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { deleteCache, getRedis, readCache, writeCache } from '../utils/redis';

const router = express.Router();
const SELECTED_LIMIT = Number(process.env.BLUVFI_SELECTED_LIMIT || 60);
const ADMIN_TOKEN = (process.env.BLUVFI_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim();
const LEADERBOARD_CACHE_KEY = 'bluvfi:testers:leaderboard';
const STATS_CACHE_KEY = 'bluvfi:testers:stats';

type AuthRequest = Request & {
  tester?: {
    id: string;
    email: string;
    role: TesterRole;
  };
};

type LeaderboardRow = {
  id: string;
  name: string;
  xHandle: string | null;
  referralCode: string;
  downlineCount: number;
  activeDownlineCount: number;
  selectedDownlineCount: number;
  score: number;
  lastActiveAt: Date | null;
};

const normalizeEmail = (email: unknown) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const requiredString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured on the backend.');
  }

  return process.env.JWT_SECRET;
};

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  xHandle: true,
  telegramHandle: true,
  referralCode: true,
  referredById: true,
  role: true,
  status: true,
  isSelected: true,
  selectedAt: true,
  removedFromSelectedAt: true,
  removedFromSelectedReason: true,
  lastActiveAt: true,
  createdAt: true,
  _count: {
    select: {
      referrals: true,
      activities: true,
    },
  },
} satisfies Prisma.TesterUserSelect;

const signToken = (user: { id: string; email: string; role: TesterRole }) =>
  jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });

const makeReferralCode = (email: string) => {
  const prefix = email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix || 'BLUVFI'}-${suffix}`;
};

const invalidateTesterCaches = () =>
  deleteCache(LEADERBOARD_CACHE_KEY, STATS_CACHE_KEY);

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  try {
    req.tester = jwt.verify(token, getJwtSecret()) as AuthRequest['tester'];
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'].trim() : '';

  if (!ADMIN_TOKEN) {
    return res.status(500).json({
      error: 'Admin access is not configured. Set BLUVFI_ADMIN_TOKEN on the backend.',
    });
  }

  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid admin token.' });
  }

  return next();
};

const buildStats = async () => {
  const cached = await readCache(STATS_CACHE_KEY);
  if (cached) return cached;

  const [registered, selected, active, inactiveRemoved] = await Promise.all([
    prisma.testerUser.count(),
    prisma.testerUser.count({ where: { isSelected: true } }),
    prisma.testerUser.count({ where: { status: TesterStatus.ACTIVE } }),
    prisma.testerUser.count({
      where: {
        isSelected: false,
        removedFromSelectedAt: { not: null },
      },
    }),
  ]);

  const stats = {
    registered,
    selected,
    selectedLimit: SELECTED_LIMIT,
    selectedSlotsOpen: Math.max(SELECTED_LIMIT - selected, 0),
    active,
    inactiveRemoved,
  };

  await writeCache(STATS_CACHE_KEY, stats, 30);
  return stats;
};

const buildLeaderboard = async () => {
  const cached = await readCache<LeaderboardRow[]>(LEADERBOARD_CACHE_KEY);
  if (cached) return cached;

  const users = await prisma.testerUser.findMany({
    where: { isSelected: true },
    select: {
      id: true,
      fullName: true,
      xHandle: true,
      referralCode: true,
      lastActiveAt: true,
      referrals: {
        select: {
          id: true,
          status: true,
          isSelected: true,
        },
      },
    },
  });

  const rows = users
    .map((user) => {
      const downlineCount = user.referrals.length;
      const activeDownlineCount = user.referrals.filter(
        (referral) => referral.status === TesterStatus.ACTIVE,
      ).length;
      const selectedDownlineCount = user.referrals.filter(
        (referral) => referral.isSelected,
      ).length;

      return {
        id: user.id,
        name: user.fullName || 'Bluvfi tester',
        xHandle: user.xHandle,
        referralCode: user.referralCode,
        downlineCount,
        activeDownlineCount,
        selectedDownlineCount,
        score: activeDownlineCount * 10 + selectedDownlineCount * 5 + downlineCount,
        lastActiveAt: user.lastActiveAt,
      };
    })
    .sort((a, b) => b.score - a.score || b.activeDownlineCount - a.activeDownlineCount);

  await writeCache(LEADERBOARD_CACHE_KEY, rows, 30);
  return rows;
};

router.post('/register', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = requiredString(req.body.password);
  const fullName = requiredString(req.body.fullName);
  const referralCode = requiredString(req.body.referralCode).toUpperCase();
  const xHandle = requiredString(req.body.xHandle);
  const telegramHandle = requiredString(req.body.telegramHandle);

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password needs at least 8 characters.' });
  }

  if (!fullName) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }

  getJwtSecret();

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const referrer = referralCode
        ? await tx.testerUser.findUnique({ where: { referralCode } })
        : null;

      return tx.testerUser.create({
        data: {
          email,
          passwordHash,
          fullName,
          xHandle: xHandle || null,
          telegramHandle: telegramHandle || null,
          referralCode: makeReferralCode(email),
          referredById: referrer?.id,
          isSelected: false,
          selectedAt: null,
          lastActiveAt: new Date(),
        },
        select: publicUserSelect,
      });
    });

    await invalidateTesterCaches();

    const redisClient = await getRedis();
    if (redisClient) {
      await redisClient.set(`bluvfi:testers:session:${user.id}`, new Date().toISOString(), 'EX', 60 * 60 * 24 * 7);
    }

    return res.status(201).json({
      user,
      token: signToken({ id: user.id, email: user.email, role: user.role }),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'An account already exists for this email.' });
    }

    console.error('Bluvfi tester registration failed:', error);
    return res.status(500).json({ error: 'Could not create your tester account.' });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = requiredString(req.body.password);

  getJwtSecret();

  const user = await prisma.testerUser.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  await prisma.testerUser.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date(), status: TesterStatus.ACTIVE },
  });

  await invalidateTesterCaches();

  return res.json({
    user: await prisma.testerUser.findUnique({ where: { id: user.id }, select: publicUserSelect }),
    token: signToken({ id: user.id, email: user.email, role: user.role }),
  });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.testerUser.findUnique({
    where: { id: req.tester!.id },
    select: publicUserSelect,
  });

  if (!user) {
    return res.status(404).json({ error: 'Tester account was not found.' });
  }

  return res.json({ user });
});

router.post('/activity', requireAuth, async (req: AuthRequest, res) => {
  const note = requiredString(req.body.note);

  const user = await prisma.testerUser.update({
    where: { id: req.tester!.id },
    data: {
      status: TesterStatus.ACTIVE,
      lastActiveAt: new Date(),
      activities: {
        create: {
          type: 'manual_check_in',
          note: note || null,
        },
      },
    },
    select: publicUserSelect,
  });

  await invalidateTesterCaches();
  return res.json({ user });
});

router.get('/leaderboard', async (_req, res) => {
  const [leaderboard, stats] = await Promise.all([buildLeaderboard(), buildStats()]);
  return res.json({ leaderboard, stats });
});

router.get('/admin/users', requireAdmin, async (_req, res) => {
  const [users, stats] = await Promise.all([
    prisma.testerUser.findMany({
      orderBy: [{ isSelected: 'desc' }, { createdAt: 'asc' }],
      select: {
        ...publicUserSelect,
        referredBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            referralCode: true,
          },
        },
      },
    }),
    buildStats(),
  ]);

  return res.json({ users, stats });
});

router.patch('/admin/users/:id/select', requireAdmin, async (req, res) => {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const selectedCount = await tx.testerUser.count({ where: { isSelected: true } });
      if (selectedCount >= SELECTED_LIMIT) {
        throw new Error(`Selected tester limit reached. Remove someone before selecting another tester.`);
      }

      return tx.testerUser.update({
        where: { id: req.params.id },
        data: {
          isSelected: true,
          status: TesterStatus.ACTIVE,
          selectedAt: new Date(),
          removedFromSelectedAt: null,
          removedFromSelectedReason: null,
        },
        select: publicUserSelect,
      });
    });

    await invalidateTesterCaches();
    return res.json({ user, stats: await buildStats() });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Selected tester limit reached')) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Bluvfi tester selection failed:', error);
    return res.status(500).json({ error: 'Could not select this tester.' });
  }
});
router.patch('/admin/users/:id/remove-selection', requireAdmin, async (req, res) => {
  const reason = requiredString(req.body.reason) || 'Removed from selected testers by admin.';

  const user = await prisma.testerUser.update({
    where: { id: req.params.id },
    data: {
      isSelected: false,
      status: TesterStatus.INACTIVE,
      removedFromSelectedAt: new Date(),
      removedFromSelectedReason: reason,
    },
    select: publicUserSelect,
  });

  await invalidateTesterCaches();
  return res.json({ user, stats: await buildStats() });
});

export default router;
