# Plan: Normalize Mock User Data

## Problem
Mock users in `src/data/users.js` use a single `name` field. The add-user form in `UserManagement.jsx` creates `firstName`, `middleInitial`, `lastName`, `suffix`, `fullName`. The table uses `user.fullName || user.name` fallback — works, but data model is inconsistent.

## Change
**File: `src/data/users.js`** — Replace `name` field with `firstName`, `lastName`, `fullName` on all 8 mock users.

| User | `firstName` | `lastName` | `fullName` |
|------|-------------|------------|------------|
| Maria Santos | Maria | Santos | Maria Santos |
| Juan dela Cruz | Juan | dela Cruz | Juan dela Cruz |
| Anna Garcia | Anna | Garcia | Anna Garcia |
| Carlos Reyes | Carlos | Reyes | Carlos Reyes |
| Rosa Fernandez | Rosa | Fernandez | Rosa Fernandez |
| Miguel Torres | Miguel | Torres | Miguel Torres |
| Sofia Diaz | Sofia | Diaz | Sofia Diaz |
| Roberto Mendoza | Roberto | Mendoza | Roberto Mendoza |

No other files need changes — `UserManagement.jsx` already handles `fullName` with `name` fallback.

## Verification
`npm run build` to confirm no breakage.
