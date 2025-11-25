# 🔒 Make Your GitHub Repository Private

## Quick Steps

### 1. Make Repository Private on GitHub

1. **Go to your repository on GitHub**
   - Visit: `https://github.com/YOUR_USERNAME/Andiamo-Events-main`
   - Replace `YOUR_USERNAME` with your GitHub username

2. **Click on Settings**
   - Located at the top right of the repository page (gear icon)

3. **Scroll to Danger Zone**
   - At the bottom of the Settings page

4. **Click "Change visibility"**
   - Then click "Make private"

5. **Confirm**
   - Type your repository name to confirm
   - Click "I understand, change repository visibility"

✅ **Done!** Your repository is now private.

---

## 🗑️ Remove .env Files from Git History

⚠️ **IMPORTANT**: If you already pushed .env files to GitHub, they're still in the git history even after making it private. Follow these steps:

### Step 1: Commit the removal (already done)
```bash
git commit -m "Remove .env files from tracking"
```

### Step 2: Remove from git history
```bash
# Remove .env files from entire git history
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env src/pages/ambassador/.env" --prune-empty --tag-name-filter cat -- --all
```

### Step 3: Force push (ONLY if you're sure!)
```bash
# ⚠️ WARNING: This rewrites history. Make sure you're the only one working on this repo!
git push origin --force --all
git push origin --force --tags
```

### Step 4: Clean up
```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## 🔐 Rotate All Secrets (CRITICAL!)

Since .env files may have been exposed, **immediately rotate**:

1. **Supabase Keys**
   - Go to Supabase Dashboard → Settings → API
   - Regenerate `anon key` and `service_role key`
   - Update your local .env file

2. **JWT Secret**
   - Generate new: `openssl rand -base64 32`
   - Update `JWT_SECRET` in .env

3. **Gmail App Password**
   - Google Account → Security → 2-Step Verification → App passwords
   - Generate new app password
   - Update `GMAIL_APP_PASSWORD` in .env

4. **Any other API keys**
   - Regenerate all API keys used in the project

---

## ✅ Verify Everything is Secure

```bash
# Check .env files are not tracked
git ls-files | findstr /i ".env"
# Should return nothing

# Check .gitignore includes .env
Get-Content .gitignore | Select-String -Pattern "\.env"
# Should show .env patterns
```

---

## 📋 Checklist

- [ ] Repository is now private on GitHub
- [ ] .env files removed from git tracking
- [ ] .gitignore updated
- [ ] .env files removed from git history (if already pushed)
- [ ] All secrets rotated (Supabase, JWT, Gmail, etc.)
- [ ] Local .env files still exist (they should!)
- [ ] Verified .env files are not in repository

---

## 🚨 If Secrets Were Exposed

1. **Rotate all secrets immediately** (most important!)
2. Review GitHub security log for unauthorized access
3. Consider using GitGuardian to scan for exposed secrets
4. Monitor for any suspicious activity

---

## 💡 Pro Tips

1. **Never commit .env files** - Always use .env.example
2. **Use GitHub Secrets** for CI/CD (if using GitHub Actions)
3. **Enable 2FA** on your GitHub account
4. **Review collaborators** regularly
5. **Use environment-specific .env files** (.env.local, .env.production)

