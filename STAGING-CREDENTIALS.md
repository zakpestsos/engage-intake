# Staging Environment Credentials

## ✅ Setup Complete

Your staging environment is fully configured and ready to use!

## 🔐 Staging Access Details

### Dev Company
- **Company Name**: Dev Company
- **Access Token**: `615e0a2323760bf9995c10b7c7ec44f8`
- **Contact Email**: zak@pest-sos.com
- **Purpose**: Development and testing only

### Test Products
1. **DEV-TST1** - Test Service 1 ($100 initial, $200 recurring)
2. **DEV-TST2** - Test Service 2 ($100 initial, $200 recurring)
3. **DEV-TST3** - Test Service 3 ($100 initial, $200 recurring)
4. **DEV-TST4** - Test Service 4 ($100 initial, $200 recurring)

## 🌐 Environment URLs

### Staging (Development Branch)
- **Deployment ID**: `AKfycbw66EhNAtOfYGKEDD2PNxgleaEciUMfU7HJq45v57-VC6P-XwXDzs1ixHfeVLd3SLge`
- **API URL**: https://script.google.com/macros/s/AKfycbw66EhNAtOfYGKEDD2PNxgleaEciUMfU7HJq45v57-VC6P-XwXDzs1ixHfeVLd3SLge/exec
- **Version**: 69 (Oct 23, 2025)

### Production (Main Branch)
- **Deployment ID**: `AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3`
- **API URL**: https://script.google.com/macros/s/AKfycby_lsZuGVzK2kvpMiEtzWzjvjqcCCP4DGzX4u31bWUXfErBzxFnGXqM1mygAZ-I-MZ3/exec
- **Version**: 68 (Oct 10, 2025)

## 🧪 Testing Locally

### Test Intake Form
```bash
# Open in browser with Dev Company token (automatically uses staging config on localhost)
# File → Open → frontend-intake/index-cyberpunk-v2.html
# Add to URL: ?token=615e0a2323760bf9995c10b7c7ec44f8

# Fill out form and submit
# Check Google Sheets for new lead
```

### Test Dashboard
```bash
# Open in browser with Dev Company token
# File → Open → frontend-dashboard/index.html
# Add to URL: ?token=615e0a2323760bf9995c10b7c7ec44f8
```

### Test API Directly
```bash
# Ping staging deployment
curl "https://script.google.com/macros/s/AKfycbw66EhNAtOfYGKEDD2PNxgleaEciUMfU7HJq45v57-VC6P-XwXDzs1ixHfeVLd3SLge/exec?test=ping"

# Expected response:
# {"status":"success","message":"Apps Script is working!","timestamp":"..."}
```

## 🚀 Quick Development Workflow

```bash
# 1. Work on development branch
git checkout development
git pull

# 2. Make changes and test locally (uses staging automatically)

# 3. Commit and push
git add .
git commit -m "Feature: description"
git push origin development

# 4. When ready for production
git checkout main
git merge development
git push origin main
```

## ⚠️ Important Notes

### Data Separation
- **Staging**: Use Dev Company token only
- **Production**: Real company tokens (JEM Pest Solutions, etc.)
- **NEVER** mix staging and production data

### URL Parameters
- Add `?env=staging` to force staging mode on any URL
- Localhost automatically uses staging config
- GitHub Pages defaults to production config

### Testing Checklist
- [ ] Intake form loads with Dev Company token in URL
- [ ] Form submission creates lead in spreadsheet
- [ ] Lead appears with "Dev Company" in Company_Name column
- [ ] Dashboard loads with Dev Company token
- [ ] Dashboard shows only Dev Company leads
- [ ] No production company data visible in staging

## 📊 Monitoring

### Check Staging Logs
```bash
clasp open
# Then: View → Logs
```

### Verify Deployments
```bash
clasp deployments
```

## 🆘 Troubleshooting

### Issue: "Invalid token" in dashboard
**Solution**: Verify you're using the Dev Company token: `7dd922454737d41335cddfc89cd43138`

### Issue: Form not loading companies
**Solution**: 
- Check browser console for errors
- Verify staging API URL is correct in config.staging.js
- Test API with ping: `curl "STAGING_URL?test=ping"`

### Issue: Changes not reflecting
**Solution**:
- Clear browser cache (Ctrl+Shift+R)
- Verify you're on development branch: `git branch`
- Check that localhost is loading staging config (check browser console)

---

**Last Updated**: Oct 23, 2025  
**Status**: ✅ Fully Configured and Ready

