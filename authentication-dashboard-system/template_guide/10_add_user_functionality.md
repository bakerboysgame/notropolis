# 10. Add User Functionality Implementation Guide

This guide explains how to implement an "Add User" feature that allows master admins and company admins to invite users to their companies.

## Overview

The Add User functionality allows:
- **Master Admins**: Invite users to any company in the system
- **Company Admins**: Invite users to their own company only
- Email invitations with 72-hour expiry
- Automatic user creation with invitation tokens

## Prerequisites

- Working authentication system with role-based access
- Email service configured (using Brevo or similar)
- D1 database with users table containing:
  - `magic_link_token` (TEXT)
  - `magic_link_expires` (DATETIME)
  - Company relationship fields

## Implementation Steps

### 1. Backend API Endpoint

Add the invite endpoint to your worker's user routes handler:

```javascript
// In worker/index.js - Add to handleUserRoutes function

case path === '/api/users/invite' && method === 'POST':
  // Check permissions - master_admin or admin only
  if (user.role !== 'master_admin' && user.role !== 'admin') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Admin access required'
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { companyId, userName, userEmail } = body;

    // Validate required fields
    if (!userName || !userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User name and email are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine target company
    let targetCompanyId = companyId;
    if (user.role === 'admin') {
      // Regular admins can only invite to their own company
      targetCompanyId = user.company_id;
    } else if (!targetCompanyId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company ID is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if email already exists
    const existingUser = await db.getUserByEmail(userEmail);
    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A user with this email already exists'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get company details
    const company = await db.getCompanyById(targetCompanyId);
    if (!company) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate invitation details
    const invitationToken = crypto.randomUUID();
    const invitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

    // Parse name into first and last
    const nameParts = userName.trim().split(' ');
    const firstName = nameParts[0] || userName;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate username from email
    const username = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create user with invitation
    const newUser = await db.createUserWithInvitation({
      email: userEmail,
      username,
      firstName,
      lastName,
      companyId: targetCompanyId,
      role: 'user', // Default role for invited users
      invitationToken,
      invitationExpires
    });

    // Send invitation email
    await emailService.sendUserInvitationEmail(
      userEmail,
      firstName,
      company.name,
      `${user.first_name} ${user.last_name}`
    );

    // Log audit event
    await db.logAuditEvent(
      user.id,
      user.company_id,
      'USER_INVITED',
      'user',
      newUser.id,
      {
        targetEmail: userEmail,
        targetCompany: company.name,
        inviterRole: user.role
      },
      request.headers.get('CF-Connecting-IP') || 'unknown',
      request.headers.get('User-Agent') || 'unknown'
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: newUser.id,
        userName: userName,
        userEmail: userEmail,
        companyName: company.name,
        invitationExpires: invitationExpires
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('User invitation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to invite user: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
```

**Important**: Make sure to pass the `emailService` parameter to your `handleUserRoutes` function:

```javascript
// Update the function signature
async function handleUserRoutes(request, authService, db, emailService) {
  // ... existing code
}

// Update the route handler call
case path.startsWith('/api/users'):
  return handleAuthenticatedRoute(request, () => handleUserRoutes(request, authService, db, emailService), rateLimiter, env);
```

### 2. Frontend Components

#### 2.1 AddUserModal Component

Create `src/components/modals/AddUserModal.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { X, UserPlus, Building2, User, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { clsx } from 'clsx';

interface Company {
  id: string;
  name: string;
  created_at: string;
  hipaa_compliant: boolean;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCompanyId?: string;
}

export function AddUserModal({ isOpen, onClose, onSuccess, defaultCompanyId }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    companyId: '',
    userName: '',
    userEmail: ''
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch companies on modal open
  useEffect(() => {
    if (isOpen) {
      if (defaultCompanyId) {
        // If default company is provided, set it and don't fetch companies
        setFormData(prev => ({ ...prev, companyId: defaultCompanyId }));
        setCompaniesLoading(false);
      } else {
        fetchCompanies();
      }
    }
  }, [isOpen, defaultCompanyId]);

  const fetchCompanies = async () => {
    try {
      setCompaniesLoading(true);
      const response = await api.get('/api/companies');
      const data = apiHelpers.handleResponse<Company[]>(response);
      setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setError('Failed to load companies');
    } finally {
      setCompaniesLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/users/invite', formData);
      apiHelpers.handleResponse<{
        userId: string;
        userName: string;
        userEmail: string;
        companyName: string;
        invitationExpires: string;
      }>(response);

      setSuccess(true);

      // Wait a moment to show success message
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ companyId: '', userName: '', userEmail: '' });
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    return (
      (defaultCompanyId || formData.companyId.trim() !== '') &&
      formData.userName.trim() !== '' &&
      formData.userEmail.trim() !== '' &&
      isValidEmail(formData.userEmail)
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Modal content - see full implementation in source files */}
    </div>
  );
}
```

#### 2.2 Update UserManagement Page (Master Admin)

Add the following to your `UserManagement.tsx`:

```typescript
// Import the modal
import { AddUserModal } from '../components/modals/AddUserModal';

// Add state
const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

// Add success handler
const handleAddUserSuccess = () => {
  // Refetch users after adding a new user
  if (currentUser?.role === 'master_admin') {
    if (selectedCompany !== 'all') {
      api.get(`/api/companies/${selectedCompany}/users`).then((response) => {
        const data = apiHelpers.handleResponse<User[]>(response);
        setUsers(data);
      }).catch((err) => {
        console.error('Failed to fetch users:', err);
      });
    } else {
      api.get('/api/users').then((response) => {
        const allUsers = apiHelpers.handleResponse<User[]>(response);
        setUsers(allUsers);
      }).catch((err) => {
        console.error('Failed to fetch users:', err);
      });
    }
  }
};

// Add modal component
<AddUserModal
  isOpen={isAddUserModalOpen}
  onClose={() => setIsAddUserModalOpen(false)}
  onSuccess={handleAddUserSuccess}
/>

// Update header to include Add User button
<div className="flex gap-3">
  <button
    onClick={() => setIsAddUserModalOpen(true)}
    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
  >
    <UserPlus className="w-5 h-5" />
    Add User
  </button>
  {/* Existing Create Company button */}
</div>
```

#### 2.3 Create CompanyUserManagement Page (Company Admin)

Create a new page `src/pages/CompanyUserManagement.tsx` that's similar to UserManagement but filtered for company admins:

```typescript
// Key differences:
// 1. Only shows users from the admin's company
// 2. Passes defaultCompanyId to AddUserModal
// 3. Different permission checks

// When rendering the modal for company admins:
<AddUserModal
  isOpen={isAddUserModalOpen}
  onClose={() => setIsAddUserModalOpen(false)}
  onSuccess={handleAddUserSuccess}
  defaultCompanyId={currentUser?.role === 'admin' ? currentUser?.companyId : undefined}
/>
```

### 3. Routing Updates

Update `src/App.tsx` to include the new route:

```typescript
import CompanyUserManagement from './pages/CompanyUserManagement';

// Add route
<Route path="/company-users" element={
  <ProtectedRoute>
    <Layout>
      <CompanyUserManagement />
    </Layout>
  </ProtectedRoute>
} />
```

### 4. Navigation Updates

Update `src/components/Sidebar.tsx` to show the appropriate link based on user role:

```typescript
const adminNavigation: NavigationItem[] = [
  { name: 'Company Users', href: '/company-users', icon: Users },
]

// Update navigation logic
const allNavigation: NavigationItem[] = user?.role === 'master_admin'
  ? [...navigation, ...masterAdminNavigation]
  : user?.role === 'admin'
  ? [...navigation, ...adminNavigation]
  : navigation
```

## Database Requirements

Ensure your users table has these fields:
- `magic_link_token` - Stores the invitation token
- `magic_link_expires` - Stores token expiration
- `verified` or `email_verified` - Tracks email verification status

The `createUserWithInvitation` method should create a user with:
- Empty or null password (set later during invitation acceptance)
- Invitation token in `magic_link_token` field
- Expiration time in `magic_link_expires` field
- `verified` = 0 (unverified)

## Email Templates

This template uses **inline HTML templates**. The invitation email is already configured in `worker/src/email-templates.js`:

```javascript
export function buildUserInvitationEmail({ brandName, firstName, companyName, inviterName, invitationLink }) {
  // Inline HTML template with:
  // - Company name
  // - Inviter's name
  // - Invitation link with token
  // - 72-hour expiry notice
}
```

To customize the invitation email, edit the `buildUserInvitationEmail` function in `email-templates.js`.

## Security Considerations

1. **Role-based Access**: Only master_admin and admin roles can invite users
2. **Company Isolation**: Admins can only invite to their own company
3. **Duplicate Prevention**: Check for existing emails before creating
4. **Token Expiry**: 72-hour limit on invitation tokens
5. **Audit Logging**: All invitations are logged for compliance

## Testing

1. **Master Admin Flow**:
   - Login as master admin
   - Navigate to User Management
   - Click "Add User"
   - Select any company
   - Enter user details
   - Verify invitation sent

2. **Company Admin Flow**:
   - Login as company admin
   - Navigate to Company Users
   - Click "Add User" (no company selection)
   - Enter user details
   - Verify user added to admin's company only

3. **API Testing**:
   ```bash
   curl -X POST https://api.yourdomain.com/api/users/invite \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "companyId": "company-id-here",
       "userName": "Test User",
       "userEmail": "test@example.com"
     }'
   ```

## Deployment

After implementing the feature, deploy the worker:

```bash
# If authenticated with wrangler login:
cd worker
wrangler deploy

# Or specify environment:
wrangler deploy --env production
```

See [11-DEPLOYMENT-WITHOUT-API-TOKEN.md](./11-DEPLOYMENT-WITHOUT-API-TOKEN.md) for deployment details.

## Common Issues

1. **Email not sending**: Check email service configuration and API keys
2. **Company not found**: Verify company ID exists in database
3. **Permission denied**: Ensure user role is admin or master_admin
4. **Duplicate email**: User with email already exists in system

## Next Steps

After implementing the add user functionality:
1. Implement the invitation acceptance flow
2. Add password reset for invited users
3. Implement bulk user import
4. Add user role management
5. Add email template customization