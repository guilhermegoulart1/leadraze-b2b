/**
 * PermissionGate Component
 * Controls visibility of UI elements based on user permissions and roles
 *
 * Usage:
 * <PermissionGate permission="campaigns:create">
 *   <button>Create Campaign</button>
 * </PermissionGate>
 *
 * <PermissionGate role="admin">
 *   <AdminPanel />
 * </PermissionGate>
 *
 * <PermissionGate permission="campaigns:delete:own" fallback={<p>No access</p>}>
 *   <DeleteButton />
 * </PermissionGate>
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const PermissionGate = ({
  permission,
  role,
  anyPermissions,
  fallback = null,
  children
}) => {
  const { hasPermission, hasRole, hasAnyPermission, user } = useAuth();

  // If no user, don't render
  if (!user) {
    return fallback;
  }

  // Check role if specified
  if (role !== undefined) {
    const hasRequiredRole = hasRole(role);
    if (!hasRequiredRole) {
      return fallback;
    }
  }

  // Check single permission if specified
  if (permission !== undefined) {
    const hasRequiredPermission = hasPermission(permission);
    if (!hasRequiredPermission) {
      return fallback;
    }
  }

  // Check if user has any of multiple permissions
  if (anyPermissions !== undefined) {
    const hasAny = hasAnyPermission(anyPermissions);
    if (!hasAny) {
      return fallback;
    }
  }

  // If all checks pass, render children
  return <>{children}</>;
};

export default PermissionGate;
