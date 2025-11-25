# Secure GitHub Setup Guide

## ✅ Steps Completed

1. **Updated .gitignore** - Added comprehensive patterns to ignore all .env files
2. **Removed .env from git tracking** - Files are now untracked but kept locally

## 🔒 Make Repository Private on GitHub

### Option 1: Via GitHub Website (Recommended)
1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/Andiamo-Events-main`
2. Click on **Settings** (top right of the repository page)
3. Scroll down to the **Danger Zone** section
4. Click **Change visibility**
5. Select **Make private**
6. Type your repository name to confirm
7. Click **I understand, change repository visibility**

### Option 2: Via GitHub CLI
```bash
gh repo edit YOUR_USERNAME/Andiamo-Events-main --visibility private
```

## 🗑️ Remove .env Files from Git History (IMPORTANT!)

If your .env files were already committed and pushed to GitHub, you need to remove them from git history:

### Step 1: Remove from current commit
```bash
# Already done - files are now untracked
git rm --cached .env
git rm --cached src/pages/ambassador/.env
```

### Step 2: Commit the removal
```bash
git add .gitignore
git commit -m "Remove .env files from tracking and update .gitignore"
```

### Step 3: Remove from git history (if already pushed)
⚠️ **WARNING**: This rewrites history. Only do this if .env files were already pushed to GitHub.

```bash
# Remove .env files from entire git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env src/pages/ambassador/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (ONLY if you're sure - this rewrites history!)
git push origin --force --all
git push origin --force --tags
```

**Alternative (safer)**: Use BFG Repo-Cleaner:
```bash
# Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## ✅ Verify .env Files Are Not Tracked

```bash
# Check if .env files are tracked
git ls-files | findstr /i ".env"

# Should return nothing if properly ignored
```

## 🔐 Additional Security Recommendations

### 1. Rotate All Secrets
Since .env files may have been exposed:
- **Supabase Keys**: Regenerate in Supabase Dashboard → Settings → API
- **JWT Secret**: Generate new secret: `openssl rand -base64 32`
- **Gmail App Password**: Generate new app password in Google Account
- **Any other API keys**: Regenerate all

### 2. Use GitHub Secrets for CI/CD
If using GitHub Actions, store secrets in:
- Repository → Settings → Secrets and variables → Actions

### 3. Add Security Alerts
- Repository → Settings → Security → Enable "Dependabot alerts"
- Enable "Dependabot security updates"

### 4. Review Access
- Repository → Settings → Collaborators
- Remove any unnecessary collaborators
- Review team access

## 📝 Next Steps

1. ✅ Commit the .gitignore changes
2. ✅ Make repository private on GitHub
3. ⚠️ Remove .env from git history (if already pushed)
4. 🔄 Rotate all exposed secrets
5. ✅ Verify .env files are not in repository

## 🚨 If .env Files Were Already Pushed

1. **Immediately rotate all secrets** (most important!)
2. Remove from git history using steps above
3. Consider using a service like GitGuardian to scan for exposed secrets
4. Review GitHub's security log for any unauthorized access

