export type Role = 'user' | 'admin' | 'superadmin';

const roleHierarchy: Record<Role, number> = {
  user: 1,
  admin: 2,
  superadmin: 3
};

export function requireRole(roles: Role | Role[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: any, res: any, next: any) => {
    const userRole = req.user?.role as Role;

    if (!userRole) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }

    if (allowedRoles.length === 0) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // Check if the user's role is sufficient for ANY of the allowed roles
    const hasPermission = allowedRoles.some((allowedRole) => {
      const requiredLevel = roleHierarchy[allowedRole];
      const userLevel = roleHierarchy[userRole];
      
      // If either role is invalid, fail this specific check
      if (requiredLevel === undefined || userLevel === undefined) return false;
      
      return userLevel >= requiredLevel;
    });

    if (hasPermission) {
      next();
    } else {
      res.status(403).json({ error: 'FORBIDDEN' });
    }
  };
}
