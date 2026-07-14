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
check "$URL/sitemap.xml"
check "$URL/opengraph-image"

# /signup must redirect (307/308, no -L) to /login?mode=signup
SIGNUP_HEADERS=$(curl -sI "$URL/signup" --max-time 10 2>/dev/null)
SIGNUP_STATUS=$(echo "$SIGNUP_HEADERS" | head -1 | grep -o '30[78]')
SIGNUP_LOCATION=$(echo "$SIGNUP_HEADERS" | grep -i "^location:" | head -1)
if [ -z "$SIGNUP_STATUS" ]; then
  echo "FAIL: $URL/signup did not return 307/308"
  ERRORS=$((ERRORS + 1))
elif ! echo "$SIGNUP_LOCATION" | grep -q "/login?mode=signup"; then
  echo "FAIL: $URL/signup redirect location is not /login?mode=signup ($SIGNUP_LOCATION)"
  ERRORS=$((ERRORS + 1))
fi

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
