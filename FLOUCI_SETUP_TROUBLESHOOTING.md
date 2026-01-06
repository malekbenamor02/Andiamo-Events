# Flouci Payment Setup - Troubleshooting 500 Error

## Error: "Failed to generate payment" (500 Internal Server Error)

This error means the backend cannot generate a payment with Flouci. Here's how to fix it:

## ✅ Step 1: Add Flouci API Keys to Backend

The backend needs your Flouci API keys. Add them to your `.env` file (in the root directory):

```env
# Flouci Payment API Configuration
FLOUCI_PUBLIC_KEY=your_actual_public_key_here
FLOUCI_SECRET_KEY=your_actual_secret_key_here
```

**Important:**
- Replace `your_actual_public_key_here` with your real Flouci Public Key
- Replace `your_actual_secret_key_here` with your real Flouci Secret Key
- Get these keys from your Flouci merchant dashboard

## ✅ Step 2: Restart Backend Server

After adding the keys, **restart your backend server**:

1. Stop the server (Ctrl+C in the terminal running `node server.cjs`)
2. Start it again: `node server.cjs` or `npm start`

**Why?** The server reads environment variables when it starts. Changes to `.env` won't take effect until you restart.

## ✅ Step 3: Verify Keys Are Loaded

Check your backend server console. You should see:
- ✅ No warnings about missing Flouci keys
- ✅ When you make a payment, you'll see logs like:
  ```
  🔔 Flouci payment generation request: ...
  📤 Calling Flouci API to generate payment...
  ```

If you see:
```
❌ Flouci API keys not configured
```
Then the keys are not being loaded. Check:
1. `.env` file exists in the root directory (same folder as `server.cjs`)
2. Keys are spelled correctly: `FLOUCI_PUBLIC_KEY` and `FLOUCI_SECRET_KEY`
3. No extra spaces or quotes around the values
4. Server was restarted after adding keys

## ✅ Step 4: Get Your Flouci API Keys

If you don't have Flouci API keys yet:

1. **Log in to Flouci Merchant Dashboard**
   - Go to: https://merchant.flouci.com (or your Flouci merchant portal)
   - Log in with your merchant account

2. **Navigate to API Settings**
   - Look for "API" or "Developer" section
   - Find "API Keys" or "Credentials"

3. **Copy Your Keys**
   - **Public Key**: Usually starts with something like `FLWPUBK-...` or similar
   - **Secret Key**: Keep this secret! Never share it publicly

4. **Add to `.env` file**
   ```env
   FLOUCI_PUBLIC_KEY=FLWPUBK-your-actual-key-here
   FLOUCI_SECRET_KEY=FLWSECK-your-actual-key-here
   ```

## 🔍 Check Backend Logs

When you try to make a payment, check your backend server console. You should see detailed logs:

**If keys are missing:**
```
❌ Flouci API keys not configured
   FLOUCI_PUBLIC_KEY: Missing
   FLOUCI_SECRET_KEY: Missing
```

**If keys are set but API call fails:**
```
📤 Calling Flouci API to generate payment...
📥 Flouci API response: { status: 400, success: false, ... }
❌ Flouci payment generation failed: ...
```

**If everything works:**
```
🔔 Flouci payment generation request: ...
📤 Calling Flouci API to generate payment...
📥 Flouci API response: { status: 200, success: true, ... }
✅ Payment generated successfully
```

## 🐛 Common Issues

### Issue 1: Keys Not Loading
**Symptom:** Server says keys are missing even after adding them

**Solution:**
- Make sure `.env` is in the same folder as `server.cjs`
- Check for typos: `FLOUCI_PUBLIC_KEY` (not `FLOUCI_PUBLIC` or `FLOUCI_PUBLIC_KEY_`)
- Restart the server after adding keys
- Check if `dotenv` package is installed: `npm install dotenv`

### Issue 2: Invalid API Keys
**Symptom:** Keys are loaded but Flouci API returns 401/403

**Solution:**
- Verify keys are correct in Flouci dashboard
- Make sure you're using **merchant** keys, not test keys (unless testing)
- Check if your Flouci account is activated

### Issue 3: Wrong Port
**Symptom:** Frontend can't reach backend

**Solution:**
- Backend should run on port **8082** (check `PORT` in `.env` or `server.cjs`)
- Frontend (Vite) runs on port **3000** and proxies `/api` to `8082`
- Make sure both servers are running

## 📝 Quick Checklist

- [ ] Flouci API keys added to `.env` file
- [ ] Keys are correct (no typos, no extra spaces)
- [ ] Backend server restarted after adding keys
- [ ] Backend server is running on port 8082
- [ ] Frontend dev server is running on port 3000
- [ ] Check backend console for error messages
- [ ] Flouci merchant account is active

## 🆘 Still Not Working?

1. **Check backend console** - Look for error messages
2. **Check browser console** - Look for network errors
3. **Verify `.env` file location** - Should be in root directory
4. **Test API keys manually** - Try calling Flouci API with curl or Postman
5. **Contact Flouci support** - If keys are correct but API still fails

## 📞 Need Help?

If you're still stuck:
1. Share the backend console error message
2. Share the browser console error (if any)
3. Verify your `.env` file has the keys (don't share the actual keys!)

---

**Remember:** Never commit your `.env` file to git! It contains sensitive keys.

