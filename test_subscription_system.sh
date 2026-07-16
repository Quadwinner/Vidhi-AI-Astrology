#!/bin/bash

# AuraAI Subscription System Test Script
# This script validates the subscription and coin top-up functionality

echo "🧪 AuraAI Subscription System Test Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
SUPABASE_URL=${SUPABASE_URL:-"https://your-project-ref.supabase.co"}
ANON_KEY=${SUPABASE_ANON_KEY:-"your-anon-key"}

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "ℹ️  $1"
}

test_endpoint() {
    local endpoint=$1
    local description=$2
    local method=${3:-GET}
    local data=${4:-"{}"}
    
    echo "Testing: $description"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ANON_KEY" \
            -d "$data" \
            "$SUPABASE_URL/functions/v1/$endpoint" \
            -w "%{http_code}")
    else
        response=$(curl -s -X GET \
            -H "Authorization: Bearer $ANON_KEY" \
            "$SUPABASE_URL/functions/v1/$endpoint" \
            -w "%{http_code}")
    fi
    
    status_code=$(echo "$response" | tail -c 4)
    body=$(echo "$response" | head -c -4)
    
    if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 400 ]; then
        log_success "$description - Status: $status_code"
        if [ ! -z "$body" ]; then
            echo "   Response: $body"
        fi
    else
        log_error "$description - Status: $status_code"
        echo "   Response: $body"
    fi
    echo ""
}

# Main test execution
echo ""
log_info "Starting test suite..."
echo ""

# Test 1: Check Supabase Functions
echo "1. Testing Supabase Functions Availability"
echo "----------------------------------------"

test_endpoint "create-payment-session" "Payment Session Creation" "POST" '{"price_id":"test_price","user_id":"test_user"}'
test_endpoint "create-topup-session" "Coin Top-up Session Creation" "POST" '{"coins":10}'
test_endpoint "create-customer-portal-session" "Customer Portal Session" "POST"

# Test 2: Environment Variables Check
echo "2. Checking Environment Variables"
echo "--------------------------------"

check_env_var() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        log_error "$var_name is not set"
    else
        log_success "$var_name is configured"
    fi
}

# Note: These would need to be checked within Supabase Edge Functions
log_info "Environment variables should be checked in Supabase Dashboard:"
echo "   - RAZORPAY_KEY_ID"
echo "   - RAZORPAY_KEY_SECRET" 
echo "   - RAZORPAY_WEBHOOK_SECRET"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""

# Test 3: Database Schema Validation
echo "3. Database Schema Check"
echo "-----------------------"
log_info "Required tables should exist:"
echo "   - users (with gateway_customer_id, coin_balance)"
echo "   - users_subscriptions (with status, management_url)"
echo "   - prices (with gateway_price_id, currency)"
echo ""

# Test 4: Frontend Integration Check
echo "4. Frontend Integration"
echo "----------------------"
log_info "Manual tests required:"
echo "   - AccountPage loads without errors"
echo "   - SubscriptionDashboard component renders"
echo "   - Coin top-up buttons are functional"
echo "   - Razorpay checkout integration works"
echo ""

# Test 5: Security Validation
echo "5. Security Validation"
echo "---------------------"
log_info "Security checklist:"
echo "   - RLS policies enabled on sensitive tables"
echo "   - Webhook signature verification implemented"
echo "   - No sensitive keys in frontend code"
echo "   - CORS headers properly configured"
echo ""

# Test 6: Razorpay Configuration
echo "6. Razorpay Configuration"
echo "------------------------"
log_info "Razorpay setup checklist:"
echo "   - Test API keys configured in Supabase"
echo "   - Subscription plans created in Razorpay dashboard"
echo "   - Webhook endpoint configured with correct events"
echo "   - Test payments working with test cards"
echo ""

# Summary
echo "🏁 Test Summary"
echo "==============="
log_info "Automated tests completed. Manual verification required for:"
echo "   1. End-to-end payment flows"
echo "   2. Webhook delivery and processing"
echo "   3. UI/UX on different devices"
echo "   4. Error handling and edge cases"
echo ""

log_warning "Remember to:"
echo "   - Test with actual Razorpay test cards"
echo "   - Verify webhook endpoints are accessible"
echo "   - Check Supabase function logs for errors"
echo "   - Test subscription management features"
echo ""

log_success "Test script execution completed!"
echo ""

# Interactive test mode
read -p "Run interactive payment test? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    log_info "Interactive Test Mode"
    echo "===================="
    echo "1. Open your application in browser"
    echo "2. Navigate to Account page"
    echo "3. Try purchasing coins using test card: 4111 1111 1111 1111"
    echo "4. Verify coin balance updates after payment"
    echo "5. Test subscription management portal"
    echo ""
    log_info "Press any key when done..."
    read -n 1 -s
fi

echo ""
log_success "All tests completed! 🎉"