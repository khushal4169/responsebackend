const Role = require('../models/Role');

const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      // Super admin has all permissions - bypass all checks
      if (req.user && req.user.userType === 'super_admin') {
        return next();
      }

      // Tenant admin has all permissions for their tenant
      if (req.user && req.user.userType === 'tenant_admin') {
        const tenantMembership = req.user.tenants.find(
          t => t.tenant.toString() === req.tenantId.toString() && t.status === 'active'
        );
        
        if (tenantMembership) {
          return next();
        }
      }

      // Check agent role permissions
      if (req.user && req.tenantMembership && req.tenantMembership.role) {
        const role = await Role.findById(req.tenantMembership.role);
        
        if (!role || !role.isActive) {
          return res.status(403).json({ message: 'Role not found or inactive' });
        }

        if (role.permissions[resource] && role.permissions[resource][action]) {
          return next();
        }
      }

      res.status(403).json({ 
        message: `Access denied. Permission required: ${resource}.${action}` 
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
};

module.exports = {
  checkPermission,
};

