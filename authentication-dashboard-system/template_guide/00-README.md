# Template Setup Guide v2.0

This guide will help you clone this repository and set it up for a new project on a different domain.

## What's New in v2.0

- **Advanced Role Management** - Custom roles with page-level access control
- **Page-Level Permissions** - Control which pages each role can access
- **Enhanced Audit Logging** - Dual-table system with denormalized display view
- **Authorization Middleware** - Centralized pattern-based endpoint authorization
- **KV-Based Rate Limiting** - 20 login attempts/15min, 100 API requests/min
- **Improved Access Denied UX** - Navigate to accessible pages or logout

## Getting Started

**New to this template?** Start here:

1. **Read This Page** - Understand what you're getting
2. **Check Prerequisites** - Make sure you have what you need
3. **Choose Your Path:**
   - **Organized?** Use [QUICK-START-CHECKLIST.md](./QUICK-START-CHECKLIST.md)
   - **Visual?** See [SETUP-FLOWCHART.md](./SETUP-FLOWCHART.md)
   - **Detailed?** Read [INDEX.md](./INDEX.md) for all guides
4. **Start Setup** - Begin with [01-INITIAL-SETUP.md](./01-INITIAL-SETUP.md)

**Already familiar?** Jump to:
- [Secrets you'll need](./SECRETS-REFERENCE.md)
- [Database schema](./DATABASE-SCHEMA-REFERENCE.md)

## Prerequisites

Before you begin, make sure you have:

- [ ] **Node.js 18+** installed
- [ ] **npm** or **yarn** installed
- [ ] **Wrangler CLI** installed (`npm install -g wrangler`)
- [ ] **Cloudflare account** (free tier works)
- [ ] **Brevo account** (free tier: 300 emails/day)
- [ ] **Domain name** (optional, can use *.workers.dev and *.pages.dev)
- [ ] **2-4 hours** of time

## What This Template Includes

### Infrastructure (All Cloudflare)
- **Cloudflare Workers** - Serverless API backend
- **Cloudflare D1** - SQLite database
- **Cloudflare KV** - Rate limiting storage
- **Cloudflare Pages** - Frontend hosting
- **Cloudflare R2** - File storage (optional)

### Frontend
- **React 18** + TypeScript + Tailwind CSS dashboard
- **Role-based navigation** - Sidebar hides inaccessible pages
- **Permission-protected routes** - Access denied with navigation options
- **Dark mode** support

### Backend
- **40+ API endpoints** - Authentication, users, companies, roles, audit
- **Authorization middleware** - Pattern-based endpoint protection
- **Rate limiting** - KV-based distributed rate limiting
- **Audit logging** - Comprehensive activity tracking

### Email (Brevo API)
- **Inline HTML templates** - No Brevo template dependencies
- **Transactional emails** - Magic links, 2FA codes, invitations, password reset

## Step-by-Step Guides

**Follow these in order for complete setup:**

| Step | Guide | What You'll Do | Time |
|------|-------|----------------|------|
| 1 | [Initial Setup](./01-INITIAL-SETUP.md) | Clone, configure files, install dependencies | 30 min |
| 2 | [Cloudflare Setup](./02-CLOUDFLARE-SETUP.md) | Create D1 database, KV namespaces, domains | 20 min |
| 3 | [Database Schema](./03-DATABASE-SCHEMA.md) | Initialize database, run migrations, create admin | 15 min |
| 4 | [Brevo Setup](./04-BREVO-SETUP.md) | Email service configuration | 15 min |
| 5 | [Secrets Management](./05-SECRETS-MANAGEMENT.md) | Configure Cloudflare secrets | 10 min |
| 6 | [Deployment](./06-DEPLOYMENT.md) | Deploy worker and frontend | 15 min |
| 7 | [Post-Deployment](./07-POST-DEPLOYMENT.md) | Verify and test everything | 15 min |
| 8 | [Customization](./08-CUSTOMIZATION.md) | Customize branding (optional) | 1-4 hrs |

**Total: 2-4 hours** (depending on experience)

## Quick Start (3 Steps)

```bash
# 1. Clone and configure
git clone <repo-url> my-project && cd my-project
npm install && cd worker && npm install && cd ..

# 2. Create Cloudflare resources
wrangler login
wrangler d1 create my-app-database
wrangler kv:namespace create RATE_LIMIT_KV
wrangler kv:namespace create RATE_LIMIT_KV --preview

# 3. Configure and deploy
# Update worker/wrangler.toml with your IDs
# Set secrets: wrangler secret put JWT_SECRET (etc.)
# Deploy: cd worker && wrangler deploy
```

See [QUICK-START-CHECKLIST.md](./QUICK-START-CHECKLIST.md) for the complete checklist.

## Additional Resources

### Quick References
- [Complete Checklist](./QUICK-START-CHECKLIST.md) - Track every step
- [Setup Flowchart](./SETUP-FLOWCHART.md) - Visual guide
- [Guide Index](./INDEX.md) - Navigate all guides
- [Template Summary](./TEMPLATE-SUMMARY.md) - Technical overview

### Deep Dives
- [Database Schema](./DATABASE-SCHEMA-REFERENCE.md) - All tables explained
- [Secrets Reference](./SECRETS-REFERENCE.md) - All secrets you need
- [Customization](./08-CUSTOMIZATION.md) - Brand colors, features, UI

## What You'll Get

After completing this setup, you'll have:

- **Working Dashboard** - Modern React app with authentication
- **Secure API** - Cloudflare Worker with rate limiting
- **Database** - D1 with auth, roles, permissions, and audit tables
- **Email Integration** - Magic links, 2FA, password reset, invitations
- **Multi-tenant** - Company-based data isolation
- **Role Management** - Hierarchical roles with page-level access
- **Audit Logging** - Complete activity tracking
- **Production Ready** - HTTPS, security headers, rate limiting
- **Global CDN** - Deployed to 300+ edge locations
- **$0/month** - Can run entirely on free tiers

## User Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| `master_admin` | All companies | Full system access, create companies |
| `admin` | Own company | Manage users, roles, view audit logs |
| `analyst` | Own company | View analytics and reports |
| `viewer` | Own company | Read-only access |
| `user` | Own company | Basic access |
| Custom roles | Own company | Configured page access |

## Need Help?

### During Setup
- **Stuck?** Each guide has a troubleshooting section
- **Lost?** Use [INDEX.md](./INDEX.md) to navigate
- **Quick answer?** Check [SECRETS-REFERENCE.md](./SECRETS-REFERENCE.md)

### Common Issues
- Database errors? → See [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md)
- Email not working? → See [04-BREVO-SETUP.md](./04-BREVO-SETUP.md)
- Deployment failing? → See [06-DEPLOYMENT.md](./06-DEPLOYMENT.md)
- Rate limiting issues? → Check KV namespace is bound correctly

## Important Notes

- **Free Tier Available** - Cloudflare and Brevo have generous free tiers
- **Security First** - All secrets stored as Cloudflare secrets (encrypted)
- **No .env for Backend** - Use `wrangler.toml` vars and Cloudflare secrets
- **Global Scale** - Auto-scales to millions of requests

---

## Ready to Start?

**Next Step:** → [01-INITIAL-SETUP.md](./01-INITIAL-SETUP.md)

Or use the **[QUICK-START-CHECKLIST.md](./QUICK-START-CHECKLIST.md)** to track your progress!

---

**Template Version:** 2.0.0
**Last Updated:** December 2024
