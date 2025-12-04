# 🔧 Refactoring Execution Plan

## Phase 1: Critical Security Fixes ✅ IN PROGRESS
1. ✅ Add ambassador login endpoint (httpOnly cookies)
2. ✅ Fix hardcoded API keys
3. ✅ Fix JWT secret fallback
4. ✅ Add rate limiting
5. ✅ Update frontend to use secure auth

## Phase 2: Backend Architecture Refactoring
1. Create server/ directory structure
2. Split server.cjs into modules
3. Create middleware, controllers, services, utils

## Phase 3: Frontend Cleanup
1. Split Dashboard.tsx
2. Extract services
3. Create AuthContext
4. Remove dead code

## Phase 4: Performance & Database
1. Add database indexes
2. Add pagination
3. Replace polling with Realtime

## Phase 5: Code Quality
1. Remove duplication
2. Apply clean code rules
3. Fix naming conventions

