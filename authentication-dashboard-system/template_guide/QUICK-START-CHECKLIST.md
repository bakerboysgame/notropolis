# Quick Start Checklist

Use this checklist to track your progress while setting up the template.

## Pre-Setup

- [ ] Node.js 18+ installed
- [ ] Wrangler CLI installed: `npm install -g wrangler`
- [ ] Cloudflare account created
- [ ] Email provider account created (Brevo OR Postmark)
- [ ] Domain registered and added to Cloudflare

## 01 - Initial Setup

- [ ] Repository cloned
- [ ] Git history reset (optional)
- [ ] `package.json` updated
- [ ] `/wrangler.toml` updated
- [ ] `/worker/wrangler.toml` updated
- [ ] `/src/config/environment.ts` updated
- [ ] Find & replace all domain references
- [ ] Find & replace brand name
- [ ] Dependencies installed: `npm install`
- [ ] Worker dependencies installed: `cd worker && npm install`

## 02 - Cloudflare Setup

- [ ] Logged into Cloudflare: `wrangler login`
- [ ] Account ID obtained and added to `worker/wrangler.toml`
- [ ] D1 database created
- [ ] Database ID added to `worker/wrangler.toml`
- [ ] Production KV namespace created
- [ ] Preview KV namespace created
- [ ] KV namespace IDs added to `worker/wrangler.toml`
- [ ] Pages project created
- [ ] Preview Pages project created (optional)
- [ ] Custom domain configured for frontend
- [ ] Custom domain configured for API
- [ ] DNS records verified
- [ ] CORS configuration updated
- [ ] API token created for CI/CD (optional)

## 03 - Database Schema

- [ ] Auth schema executed: `wrangler d1 execute YOUR_DB --file=../auth_schema.sql`
- [ ] Analytics schema executed: `wrangler d1 execute YOUR_DB --file=../analytics_schema.sql`
- [ ] Migrations applied (in order):
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0001_create_role_access_tables.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0002_create_company_available_pages.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0003_create_custom_roles.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0004_create_user_permissions.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0005_create_role_visibility_restrictions.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0006_fix_custom_roles_trigger.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0007_fix_user_permissions.sql`
  - [ ] `wrangler d1 execute YOUR_DB --file=../migrations/0008_fix_role_visibility_restrictions.sql`
- [ ] All tables verified: `wrangler d1 execute YOUR_DB --command="SELECT name FROM sqlite_master WHERE type='table'"`
- [ ] System company created
- [ ] First company created
- [ ] Company ID obtained
- [ ] First admin user created
- [ ] User verified in database
- [ ] Company admin reference updated

## 04 - Email Setup (Choose One Provider)

### Option A: Brevo (free tier: 300 emails/day)

- [ ] Brevo account created and verified
- [ ] API key generated and saved
- [ ] Sender email/domain verified in Brevo
- [ ] `SENDER_NAME` and `SENDER_EMAIL` set in `worker/wrangler.toml`
- [ ] Webhooks configured (optional)
- [ ] Webhook secret saved (if using webhooks)
- [ ] Test email sent successfully

See [04A-BREVO-SETUP.md](./04A-BREVO-SETUP.md) for detailed instructions.

### Option B: Postmark (better deliverability, built-in tracking)

- [ ] Postmark account created
- [ ] Server created (Live for production)
- [ ] Server API Token generated and saved
- [ ] Sender domain/email verified
- [ ] Email service switched to `email-postmark.js`
- [ ] `SENDER_NAME` and `SENDER_EMAIL` set in `worker/wrangler.toml`
- [ ] Webhooks configured (optional)
- [ ] Test email sent successfully

See [04B-POSTMARK-SETUP.md](./04B-POSTMARK-SETUP.md) for detailed instructions.

**Note**: Both providers use the same **inline HTML templates** in `email-templates.js`.

## 05 - Secrets Management

**Required Secrets** (via `wrangler secret put`):
- [ ] JWT_SECRET generated: `openssl rand -hex 32`
- [ ] JWT_SECRET set: `wrangler secret put JWT_SECRET`
- [ ] Email provider secret set (choose one):
  - [ ] BREVO_API_KEY: `wrangler secret put BREVO_API_KEY` (if using Brevo)
  - [ ] POSTMARK_SERVER_TOKEN: `wrangler secret put POSTMARK_SERVER_TOKEN` (if using Postmark)
- [ ] BREVO_WEBHOOK_SECRET set (optional, if using Brevo webhooks)
- [ ] Secrets verified: `wrangler secret list`

**Configuration Variables** (in `worker/wrangler.toml [vars]`):
- [ ] BRAND_NAME set
- [ ] CLIENT_URL set
- [ ] SERVER_URL set
- [ ] SENDER_NAME set
- [ ] SENDER_EMAIL set

**Local Development**:
- [ ] `.dev.vars` created in `/worker/`
- [ ] `.dev.vars` added to `.gitignore`
- [ ] Secrets documented in password manager

## 06 - Deployment

### Worker Deployment
- [ ] Worker tested locally: `wrangler dev`
- [ ] Local health check successful
- [ ] Worker deployed: `wrangler deploy`
- [ ] Production health check successful
- [ ] Custom domain working for API

### Frontend Deployment
- [ ] Environment config verified
- [ ] Frontend built: `npm run build`
- [ ] Build completed without errors
- [ ] Deployed to Pages: `npm run deploy`
- [ ] Preview deployment (optional): `npm run deploy:preview`
- [ ] Custom domain working for frontend

### CI/CD (Optional)
- [ ] Git integration configured
- [ ] GitHub Actions workflow created
- [ ] CLOUDFLARE_API_TOKEN added to secrets
- [ ] Automated deployment tested

## 07 - Post-Deployment

### Health Checks
- [ ] API health check: `curl https://api.your-domain.com/api/health`
- [ ] Frontend accessible: `curl -I https://dashboard.your-domain.com`

### Authentication Tests
- [ ] Login endpoint tested
- [ ] Magic link request tested
- [ ] Magic link email received
- [ ] Can log in with admin account
- [ ] Dashboard loads after login

### Security Tests
- [ ] Rate limiting working
- [ ] Password validation working
- [ ] Security headers present
- [ ] CORS working from frontend
- [ ] SSL certificates active (A+ rating)

### Database Tests
- [ ] Companies query successful
- [ ] Users query successful
- [ ] Sessions being created
- [ ] Audit logs recording

### Email Tests
- [ ] Magic link email received
- [ ] Password reset email received
- [ ] Email templates rendering correctly
- [ ] Links in emails working

### Frontend Tests
- [ ] Login page works
- [ ] Dashboard loads
- [ ] Navigation works
- [ ] User management works (if master_admin)
- [ ] Company management works (if enabled)
- [ ] Audit logs visible
- [ ] Settings page works

### Performance Tests
- [ ] API response times < 500ms
- [ ] Frontend loads < 2 seconds
- [ ] No console errors
- [ ] No network errors

### Monitoring
- [ ] Worker logs reviewed: `wrangler tail`
- [ ] No errors in logs
- [ ] Uptime monitoring configured (optional)
- [ ] Cloudflare analytics reviewed

## 08 - Customization

- [ ] Brand colors updated
- [ ] Logo replaced
- [ ] Favicons replaced
- [ ] Email templates branded
- [ ] Feature flags configured
- [ ] UI navigation customized
- [ ] Dashboard customized
- [ ] Roles customized (if needed)
- [ ] Documentation updated

## Post-Launch

- [ ] **CRITICAL**: Default admin password changed from `admin123`
- [ ] Additional admin users created
- [ ] User roles assigned
- [ ] Company structure finalized
- [ ] Email notifications tested
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured
- [ ] Team trained on system
- [ ] Documentation shared with team
- [ ] Emergency contacts documented

## Maintenance Schedule

- [ ] Weekly: Review audit logs
- [ ] Weekly: Check error rates in Cloudflare
- [ ] Monthly: Review user access
- [ ] Quarterly: Rotate secrets (JWT_SECRET, API keys)
- [ ] Quarterly: Database cleanup (expired sessions, old logs)
- [ ] Quarterly: Security audit
- [ ] Yearly: Review and update dependencies

## Troubleshooting Resources

If you encounter issues, refer to:
- **Database Issues**: [03-DATABASE-SCHEMA.md](./03-DATABASE-SCHEMA.md#troubleshooting)
- **Email Issues (Brevo)**: [04A-BREVO-SETUP.md](./04A-BREVO-SETUP.md#troubleshooting)
- **Email Issues (Postmark)**: [04B-POSTMARK-SETUP.md](./04B-POSTMARK-SETUP.md#troubleshooting)
- **Deployment Issues**: [06-DEPLOYMENT.md](./06-DEPLOYMENT.md#troubleshooting)
- **Post-Deployment Issues**: [07-POST-DEPLOYMENT.md](./07-POST-DEPLOYMENT.md#troubleshooting-common-issues)

## Support Contacts

**Cloudflare Support**: https://support.cloudflare.com/
**Brevo Support**: https://www.brevo.com/support/
**Postmark Support**: https://postmarkapp.com/support
**Team Lead**: [Your contact info]

---

## Completion

🎉 **Congratulations!** Once all items are checked, your application is fully deployed and ready for use!

**Final Steps:**
1. Change the admin password
2. Share access with your team
3. Begin using the application
4. Schedule regular maintenance

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Production URL**: https://_______________  
**API URL**: https://_______________

