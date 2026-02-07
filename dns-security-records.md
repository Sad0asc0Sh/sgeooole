# DNS Security Records for ekgkala.ir
## SPF, DKIM, and DMARC Configuration

---

## 1. SPF Record (Sender Policy Framework)

**Type:** `TXT`  
**Host/Name:** `@` (or `ekgkala.ir`)  
**Value:**
```
v=spf1 mx a ip4:YOUR_SERVER_IP include:_spf.google.com -all
```

### Configuration Options:
- Replace `YOUR_SERVER_IP` with your actual server IP
- If using Google Workspace: `include:_spf.google.com`
- If using Microsoft 365: `include:spf.protection.outlook.com`
- If using Mailgun: `include:mailgun.org`
- If using SendGrid: `include:sendgrid.net`

**Example (Google Workspace + Own Server):**
```
v=spf1 mx a ip4:185.123.45.67 include:_spf.google.com -all
```

**Example (No email from this domain):**
```
v=spf1 -all
```

---

## 2. DKIM Record (DomainKeys Identified Mail)

**Type:** `TXT`  
**Host/Name:** `default._domainkey` (or as provided by your email service)  
**Value:**
```
v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
```

### How to Generate DKIM:

#### Option A: Using OpenSSL (Self-hosted mail server)
```bash
# Generate private key
openssl genrsa -out dkim_private.pem 2048

# Extract public key
openssl rsa -in dkim_private.pem -pubout -outform der 2>/dev/null | openssl base64 -A
```

Then create the TXT record:
```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...YOUR_KEY...
```

#### Option B: Google Workspace
1. Go to Admin Console → Apps → Google Workspace → Gmail → Authenticate Email
2. Generate new record, copy the provided value
3. Host name will be: `google._domainkey`

#### Option C: If not sending email from this domain
You can skip DKIM or set an empty record.

---

## 3. DMARC Record (Domain-based Message Authentication)

**Type:** `TXT`  
**Host/Name:** `_dmarc`  
**Value (Strict - Recommended for Production):**
```
v=DMARC1; p=reject; rua=mailto:dmarc-reports@ekgkala.ir; ruf=mailto:dmarc-forensic@ekgkala.ir; sp=reject; adkim=s; aspf=s; pct=100;
```

### DMARC Policy Levels:

#### Monitoring Mode (Start Here):
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@ekgkala.ir; pct=100;
```

#### Quarantine Mode (After Monitoring):
```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@ekgkala.ir; sp=quarantine; pct=100;
```

#### Reject Mode (Full Protection):
```
v=DMARC1; p=reject; rua=mailto:dmarc-reports@ekgkala.ir; ruf=mailto:dmarc-forensic@ekgkala.ir; sp=reject; adkim=s; aspf=s; pct=100;
```

### DMARC Parameters Explained:
- `p=reject` - Policy for main domain (none/quarantine/reject)
- `sp=reject` - Policy for subdomains
- `rua=` - Aggregate report email address
- `ruf=` - Forensic report email address
- `adkim=s` - Strict DKIM alignment
- `aspf=s` - Strict SPF alignment
- `pct=100` - Apply to 100% of emails

---

## 4. Additional Recommended DNS Records

### CAA Record (Certificate Authority Authorization)
**Type:** `CAA`  
**Host/Name:** `@`  
**Value:**
```
0 issue "letsencrypt.org"
0 issuewild "letsencrypt.org"
0 iodef "mailto:security@ekgkala.ir"
```

### MTA-STS Record (SMTP Security)
**Type:** `TXT`  
**Host/Name:** `_mta-sts`  
**Value:**
```
v=STSv1; id=20250207T000000;
```

Then create a file at: `https://mta-sts.ekgkala.ir/.well-known/mta-sts.txt`
```
version: STSv1
mode: enforce
mx: mail.ekgkala.ir
max_age: 604800
```

### BIMI Record (Brand Indicators for Message Identification)
**Type:** `TXT`  
**Host/Name:** `default._bimi`  
**Value:**
```
v=BIMI1; l=https://ekgkala.ir/logo.svg;
```

---

## Complete DNS Records Summary

| Type | Host/Name | Value |
|------|-----------|-------|
| TXT | @ | `v=spf1 mx a ip4:YOUR_IP include:_spf.google.com -all` |
| TXT | default._domainkey | `v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY` |
| TXT | _dmarc | `v=DMARC1; p=reject; rua=mailto:dmarc-reports@ekgkala.ir; sp=reject; pct=100;` |
| CAA | @ | `0 issue "letsencrypt.org"` |
| CAA | @ | `0 issuewild "letsencrypt.org"` |

---

## Verification Commands

```bash
# Check SPF
dig TXT ekgkala.ir +short

# Check DKIM
dig TXT default._domainkey.ekgkala.ir +short

# Check DMARC
dig TXT _dmarc.ekgkala.ir +short

# Check CAA
dig CAA ekgkala.ir +short
```

## Online Verification Tools
- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx)
- [DMARC Analyzer](https://www.dmarcanalyzer.com/dmarc/dmarc-record-check/)
- [Mail Tester](https://www.mail-tester.com/)
