import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../../../middleware/roleGuard';


const mockReq = (role?: string) => ({ user: role ? { role } : undefined } as any);
const mockRes = () => {
  const r: any = {};
  r.status = vi.fn(() => r);
  r.json = vi.fn(() => r);
  return r;
};

describe('Role Guard (requireRole)', () => {
  const next = vi.fn();

  describe('requireRole("admin")', () => {
    const guard = requireRole('admin');

    it('req.user = { role: "admin" } → next() called with no args', () => {
      const req = mockReq('admin');
      const res = mockRes();
      guard(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeUndefined();
    });

    it('req.user = { role: "user" } → 403 FORBIDDEN', () => {
      const req = mockReq('user');
      const res = mockRes();
      guard(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'FORBIDDEN' });
    });

    it('req.user = undefined → 401 UNAUTHENTICATED', () => {
      const req = mockReq();
      const res = mockRes();
      guard(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'UNAUTHENTICATED' });
    });
  });

  describe('requireRole(["user", "admin"]) (OR logic)', () => {
    const guard = requireRole(['user', 'admin']);

    it('role "user" → next()', () => {
      guard(mockReq('user'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('role "admin" → next()', () => {
      guard(mockReq('admin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('role "superadmin" → next() (hierarchy: superadmin > admin)', () => {
      guard(mockReq('superadmin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('no role match → 403', () => {
      // Suppose we have an unknown role or a role that is lower in a different system
      const res = mockRes();
      guard(mockReq('guest'), res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Role Hierarchy', () => {
    const guard = requireRole('user');

    it('"superadmin" passes (inherits all lower roles)', () => {
      guard(mockReq('superadmin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('"admin" passes (inherits user)', () => {
      guard(mockReq('admin'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it('"user" passes', () => {
      guard(mockReq('user'), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('empty array requireRole([]) → always 403', () => {
      const guard = requireRole([]);
      const res = mockRes();
      guard(mockReq('superadmin'), res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
    
    // Note: requireRole called with unknown role string will throw a TS error at compile time
    // e.g. requireRole('fake_role') -> compile-time error.
  });
});
