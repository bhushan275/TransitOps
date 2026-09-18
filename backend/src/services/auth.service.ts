import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { signToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';
import { LoginInput } from '../validation/schemas';

export const AuthService = {
  async login({ email, password }: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Invalid email or password');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      driverId: user.driverId,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        driverId: user.driverId,
      },
    };
  },

  async register(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    driverId?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw AppError.conflict('A user with this email already exists.');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        driverId: input.driverId ?? null,
      },
    });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  },
};
