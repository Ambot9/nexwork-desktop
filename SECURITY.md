# Security Guide for Nexwork Desktop

## Overview

Nexwork Desktop is an Electron-based desktop application. This document outlines the security measures implemented and best practices for users and developers.

## ⚠️ Important: Desktop App Security

**Nexwork is NOT vulnerable to traditional web attacks like DDoS** because:
- It's a desktop application, not a web server
- Runs locally on the user's computer
- No incoming network connections
- No public IP/port exposed

## 🔒 Security Measures Implemented

### 1. **Electron Security**

✅ **Context Isolation** - Separates main and renderer processes
```typescript
contextIsolation: true
```

✅ **No Node Integration** - Prevents direct Node.js access from renderer
```typescript
nodeIntegration: false
```

✅ **Sandboxing** - Limits renderer process capabilities
```typescript
sandbox: true
```

✅ **Web Security** - Enforces same-origin policy
```typescript
webSecurity: true
```

✅ **Content Security Policy (CSP)** - Restricts resource loading

### 2. **Input Validation**

All user inputs are validated and sanitized:

- **Workspace Paths** - Prevents directory traversal
- **Feature Names** - Sanitized to prevent command injection
- **Branch Names** - Validates against git naming rules
- **Terminal Commands** - Sanitized before execution
- **Project Names** - Alphanumeric validation

### 3. **Rate Limiting**

Prevents abuse of expensive operations:
- Feature operations: 20/minute
- Git operations: 30/minute
- Terminal commands: 100/minute

### 4. **Path Security**

- All file paths validated to stay within workspace
- System directories are forbidden
- Prevents directory traversal (../)
- Absolute path validation

## 🛡️ Security Features

### File System Protection
- Workspace root validation
- Prevents access to system directories
- Path traversal prevention
- Validates file existence before operations

### Command Injection Prevention
- All commands sanitized
- Dangerous characters removed: `; & | \` $ ( ) { } [ ] < >`
- Length limits enforced
- Null byte removal

### Git Security
- Branch name validation
- Prevents malicious git operations
- Repository integrity checks
- Safe worktree management

## 🔐 For Users

### Best Practices

1. **Choose Safe Workspace**
   - Use a dedicated folder for Nexwork projects
   - Don't use system directories (/System, C:\Windows, etc.)
   - Keep workspace separate from personal files

2. **Update Regularly**
   - Keep Nexwork updated to latest version
   - Security patches are released as needed

3. **Verify Git Repositories**
   - Only clone from trusted sources
   - Review repository contents before creating features
   - Be cautious with third-party templates

4. **Terminal Usage**
   - Review commands before executing
   - Don't run untrusted scripts
   - Use integrated terminal for safer execution

### Permissions

Nexwork requires:
- ✅ File system access (to manage git repositories)
- ✅ Process execution (to run git commands)
- ✅ Auto-launch (optional, for convenience)

Nexwork does NOT:
- ❌ Access network except for git operations
- ❌ Collect telemetry or analytics
- ❌ Send data to external servers
- ❌ Access system keychain/passwords

## 👨‍💻 For Developers

### Security Checklist

When adding new features:

- [ ] Validate all user inputs
- [ ] Sanitize file paths
- [ ] Check rate limits for expensive operations
- [ ] Use security utilities from `electron/main/security.ts`
- [ ] Test with malicious inputs
- [ ] Review IPC handler permissions

### Code Examples

**Validating Workspace Path:**
```typescript
import { validateWorkspacePath } from './security'

if (!validateWorkspacePath(workspacePath)) {
  throw new Error('Invalid workspace path')
}
```

**Sanitizing Feature Names:**
```typescript
import { sanitizeFeatureName } from './security'

const safeName = sanitizeFeatureName(userInput)
```

**Rate Limiting:**
```typescript
import { featureOperationLimiter } from './security'

if (!featureOperationLimiter.checkLimit('create-feature')) {
  throw new Error('Too many requests. Please wait.')
}
```

## 🚨 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email: security@nexwork.dev (or your email)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours.

## 📝 Security Updates

### Version 1.0.0 (Current)
- ✅ Context isolation enabled
- ✅ Sandbox mode enabled
- ✅ Input validation implemented
- ✅ Rate limiting added
- ✅ CSP configured
- ✅ Path traversal prevention

## 🔗 Resources

- [Electron Security Guide](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Desktop App Security](https://owasp.org/www-project-desktop-app-security-top-10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## ⚖️ License

Security is everyone's responsibility. Contributions to improve Nexwork's security are welcome!

---

**Last Updated:** February 2026  
**Security Version:** 1.0.0
