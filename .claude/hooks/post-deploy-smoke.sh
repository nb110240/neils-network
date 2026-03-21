#!/bin/bash
# Post-deploy smoke test — runs after vercel --prod
# Checks that savvo.app is responding and key pages load

URL="https://savvo.app"
ERRORS=0

check() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$1" -L --max-time 10 2>/dev/null)
  if [ "$STATUS" != "200" ]; then
    echo "FAIL: $1 returned $STATUS"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "Running smoke tests on $URL..."
check "$URL"
check "$URL/login"
check "$URL/pricing"
check "$URL/privacy"
check "$URL/terms"

# Check camera permissions header
PERMS=$(curl -sI "$URL" --max-time 10 2>/dev/null | grep -i "permissions-policy" | head -1)
if echo "$PERMS" | grep -q "camera=()"; then
  echo "FAIL: Camera still blocked in Permissions-Policy"
  ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "SMOKE TEST FAILED: $ERRORS errors"
  exit 1
else
  echo "All smoke tests passed"
fi
