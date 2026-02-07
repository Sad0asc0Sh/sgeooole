# Security Implementation Guide
## ekgkala.ir - Complete Security Hardening

---

## Pre-Implementation Checklist

- [ ] Backup current nginx configuration
- [ ] Backup current next.config.js
- [ ] Ensure SSH access to server
- [ ] Have DNS panel access ready
- [ ] Schedule maintenance window (recommended)

---

## Step 1: Install Required Nginx Modules

```bash
# Check if headers-more module is installed
nginx -V 2>&1 | grep -o headers-more

# If not installed, install it:
sudo apt update
sudo apt install nginx-extras -y

# Or for Ubuntu 22.04+:
sudo apt install libnginx-mod-http-headers-more-filter -y
```

---

## Step 2: Generate DH Parameters

```bash
# Generate strong DH parameters (this takes a few minutes)
sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Verify the file was created
ls -la /etc/nginx/dhparam.pem
```

---

## Step 3: Backup Current Configuration

```bash
# Backup nginx config
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d)
sudo cp /etc/nginx/sites-available/ekgkala.ir /etc/nginx/sites-available/ekgkala.ir.backup.$(date +%Y%m%d)

# Backup Next.js config
cp next.config.js next.config.js.backup.$(date +%Y%m%d)
```

---

## Step 4: Deploy Nginx Configuration

```bash
# Copy the new configuration
sudo cp nginx-security-config.conf /etc/nginx/sites-available/ekgkala.ir

# Create symlink if not exists
sudo ln -sf /etc/nginx/sites-available/ekgkala.ir /etc/nginx/sites-enabled/ekgkala.ir

# Test nginx configuration syntax
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# Check nginx status
sudo systemctl status nginx
```

---

## Step 5: Deploy Next.js Configuration

```bash
# Navigate to your Next.js project
cd /var/www/ekgkala.ir  # or your project directory

# Backup and update next.config.js
cp next.config.js next.config.js.backup
cp next.config.security.js next.config.js

# Rebuild the application
npm run build

# Restart PM2 or your process manager
pm2 restart all
# OR
pm2 restart ekgkala

# Check application status
pm2 status
```

---

## Step 6: Add DNS Records

1. **Login to your DNS provider** (e.g., Cloudflare, Namecheap, etc.)

2. **Add SPF Record:**
   - Type: TXT
   - Name: @
   - Value: `v=spf1 mx a ip4:YOUR_SERVER_IP -all`

3. **Add DMARC Record:**
   - Type: TXT
   - Name: _dmarc
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@ekgkala.ir; pct=100;`
   
   *(Start with p=none for monitoring, then change to p=reject after verification)*

4. **Add CAA Records:**
   - Type: CAA
   - Name: @
   - Value: `0 issue "letsencrypt.org"`

---

## Step 7: Verification Commands

### Test Nginx Configuration
```bash
sudo nginx -t
```

### Test SSL/TLS Configuration
```bash
# Check supported protocols
nmap --script ssl-enum-ciphers -p 443 ekgkala.ir

# Or use OpenSSL
openssl s_client -connect ekgkala.ir:443 -tls1_2
openssl s_client -connect ekgkala.ir:443 -tls1_3

# These should FAIL (TLS 1.0/1.1 disabled):
openssl s_client -connect ekgkala.ir:443 -tls1
openssl s_client -connect ekgkala.ir:443 -tls1_1
```

### Test Security Headers
```bash
# Check all headers
curl -I https://ekgkala.ir

# Check specific headers
curl -s -D - https://ekgkala.ir -o /dev/null | grep -E "Strict-Transport|X-Frame|X-Content|Content-Security"

# Verify X-Powered-By is removed
curl -I https://ekgkala.ir 2>&1 | grep -i "powered"
# Should return nothing
```

### Test Rate Limiting
```bash
# Test auth endpoint (should get 429 after 2 requests)
for i in {1..5}; do curl -s -o /dev/null -w "%{http_code}\n" https://ekgkala.ir/api/auth/login; done

# Test general API
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://ekgkala.ir/api/test; done
```

### Test DNS Records
```bash
# SPF
dig TXT ekgkala.ir +short

# DMARC
dig TXT _dmarc.ekgkala.ir +short

# CAA
dig CAA ekgkala.ir +short
```

---

## Step 8: Online Security Testing

Run these tests after implementation:

1. **SSL Labs Test:**
   - https://www.ssllabs.com/ssltest/analyze.html?d=ekgkala.ir
   - Target: A+ rating

2. **Security Headers Test:**
   - https://securityheaders.com/?q=ekgkala.ir
   - Target: A+ rating

3. **Mozilla Observatory:**
   - https://observatory.mozilla.org/analyze/ekgkala.ir
   - Target: A+ rating

4. **HSTS Preload Status:**
   - https://hstspreload.org/?domain=ekgkala.ir

5. **Email Security:**
   - https://mxtoolbox.com/domain/ekgkala.ir/

---

## Troubleshooting

### Nginx Won't Start
```bash
# Check error log
sudo tail -50 /var/log/nginx/error.log

# Check for syntax errors
sudo nginx -t

# Common issues:
# - Missing dhparam.pem file
# - Missing headers-more module
# - SSL certificate path incorrect
```

### Rate Limiting Too Strict
```bash
# Increase burst values in nginx config
# Example: change 'burst=2' to 'burst=5'

# Then reload
sudo nginx -t && sudo systemctl reload nginx
```

### CSP Breaking Functionality
```bash
# Check browser console for CSP violations
# Adjust the CSP in next.config.js accordingly

# Common additions needed:
# - External APIs: add to connect-src
# - External scripts: add to script-src
# - External fonts: already included for Google Fonts
```

### Headers Not Appearing
```bash
# Verify headers-more module is loaded
nginx -V 2>&1 | grep headers-more

# If missing, install:
sudo apt install nginx-extras -y
sudo systemctl restart nginx
```

---

## Rollback Procedure

If something breaks:

```bash
# Restore nginx config
sudo cp /etc/nginx/sites-available/ekgkala.ir.backup.YYYYMMDD /etc/nginx/sites-available/ekgkala.ir
sudo nginx -t && sudo systemctl reload nginx

# Restore next.config.js
cp next.config.js.backup.YYYYMMDD next.config.js
npm run build
pm2 restart all
```

---

## Maintenance Commands

```bash
# Renew SSL certificates (Let's Encrypt auto-renewal)
sudo certbot renew --dry-run

# Check certificate expiry
sudo certbot certificates

# View rate limit logs
sudo grep "limiting" /var/log/nginx/ekgkala.ir-error.log

# Monitor real-time access
sudo tail -f /var/log/nginx/ekgkala.ir-access.log
```

---

## Security Checklist - Final Verification

- [ ] SSL Labs shows A+ rating
- [ ] Security Headers shows A+ rating  
- [ ] TLS 1.0/1.1 connection attempts fail
- [ ] X-Powered-By header is removed
- [ ] Server version is hidden
- [ ] HSTS header is present
- [ ] Rate limiting is working
- [ ] Sensitive pages are not cached
- [ ] SPF record is configured
- [ ] DMARC record is configured
- [ ] CAA record is configured

---

## Monthly Security Tasks

1. **Review access logs** for suspicious patterns
2. **Update dependencies**: `npm audit fix`
3. **Check SSL certificate** expiry
4. **Review DMARC reports** for email spoofing attempts
5. **Run security scanners** (SSL Labs, Security Headers)
6. **Update Nginx** when new versions are released
