# AuraAI Razorpay Configuration Guide

## Environment Variables Setup

Add these environment variables to your Supabase Edge Functions:

### Required Razorpay Keys
```bash
RAZORPAY_KEY_ID=rzp_test_RIdOOohLUUFJhr
RAZORPAY_KEY_SECRET=yKfmYVMY9NTrxW9sNj4N4VO2
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Coin Top-up Pricing (in paise - 1 INR = 100 paise)
```bash
RAZORPAY_TOPUP_10_PAISE=9900     # ₹99 for 10 coins
RAZORPAY_TOPUP_25_PAISE=19900    # ₹199 for 25 coins  
RAZORPAY_TOPUP_50_PAISE=34900    # ₹349 for 50 coins
RAZORPAY_TOPUP_100_PAISE=59900   # ₹599 for 100 coins
```

### Gateway Selection
```bash
DEFAULT_GATEWAY=razorpay         # Use razorpay as default for Indian users
```

## Razorpay Dashboard Setup

### 1. Create Subscription Plans
In your Razorpay dashboard, create these subscription plans:

**Monthly Plan:**
- Plan ID: `plan_monthly_999`
- Amount: ₹999
- Interval: 1 month

**Yearly Plan:**
- Plan ID: `plan_yearly_9999`  
- Amount: ₹9,999
- Interval: 1 year

### 2. Update Database
Update your `prices` table in Supabase with Razorpay plan IDs:

```sql
UPDATE prices 
SET gateway_price_id = 'plan_monthly_999' 
WHERE id = 'your_monthly_price_id' AND currency = 'inr';

UPDATE prices 
SET gateway_price_id = 'plan_yearly_9999' 
WHERE id = 'your_yearly_price_id' AND currency = 'inr';
```

### 3. Webhook Configuration
Set up webhook endpoint in Razorpay dashboard:
- URL: `https://your-project-ref.supabase.co/functions/v1/razorpay-webhook`
- Events: Select all subscription and payment events
- Secret: Use the value from RAZORPAY_WEBHOOK_SECRET

## Features Implemented

### ✅ Subscription Management
- Multi-gateway support (Razorpay + Stripe)
- Customer portal integration
- Subscription lifecycle management
- Webhook handling for real-time updates

### ✅ Coin Top-up System
- Multiple coin packages (10, 25, 50, 100)
- Razorpay Checkout integration
- Automatic balance updates via webhooks
- Mobile-responsive payment flow

### ✅ User Dashboard
- Modern subscription management UI
- Tabbed interface (Overview, Billing, Coins)
- Real-time subscription status
- Payment history display
- Coin usage tracking

## Testing Instructions

### 1. Test Subscription Flow
1. Navigate to home page
2. Select a subscription plan
3. Complete payment with Razorpay test cards
4. Verify subscription status in dashboard

### 2. Test Coin Top-up
1. Go to Account page
2. Click on "Coin Management" tab
3. Select coin amount and purchase
4. Use Razorpay test cards: 4111 1111 1111 1111
5. Verify coins are added to balance

### 3. Test Management Features
1. Access subscription dashboard
2. Try updating payment method (redirects to Razorpay)
3. View payment history
4. Check coin usage information

## Razorpay Test Cards

**Success:**
- 4111 1111 1111 1111
- 5555 5555 5555 4444

**Failure:**
- 4000 0000 0000 0002

**CVV:** Any 3 digits
**Expiry:** Any future date

## Production Checklist

### Before Going Live:
1. ✅ Switch Razorpay keys from test to live
2. ✅ Update webhook URLs to production
3. ✅ Test all payment flows thoroughly
4. ✅ Verify subscription cancellation works
5. ✅ Check coin top-up webhooks
6. ✅ Test mobile responsiveness
7. ✅ Validate error handling

### Security Considerations:
- ✅ All sensitive keys stored in Supabase secrets
- ✅ Webhook signature verification implemented
- ✅ RLS policies enabled on database
- ✅ Input validation on all endpoints
- ✅ Error logging for debugging

## Support & Troubleshooting

### Common Issues:

**Payment fails with "Customer already exists":**
- This happens when Razorpay has a customer but our DB doesn't
- Fixed with proper error handling in create-payment-session

**Subscription status not updating:**
- Check webhook configuration in Razorpay
- Verify webhook secret matches environment variable
- Check Supabase function logs for errors

**Coin top-up not reflecting:**
- Ensure payment.captured webhook is configured
- Check webhook payload includes user_id and topup_coins
- Verify database permissions for coin balance updates

### Getting Help:
1. Check Supabase function logs for errors
2. Review Razorpay dashboard for webhook delivery status  
3. Verify all environment variables are set correctly
4. Test webhook locally using ngrok for development