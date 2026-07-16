// Simple test for direct subscription function
// Run this in browser console while logged in

async function testDirectSubscriptionFunction() {
    try {
        console.log('🧪 Testing create-direct-subscription function...');
        
        // Get current session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.error('❌ No active session. Please log in first.');
            return;
        }
        
        console.log('✅ User authenticated:', session.user.email);
        console.log('👤 User ID:', session.user.id);
        
        // Test the function with a simple request
        console.log('🔄 Calling create-direct-subscription...');
        
        const { data, error } = await window.supabase.functions.invoke(
            'create-direct-subscription',
            {
                body: {
                    plan_type: 'monthly',
                    user_id: session.user.id
                }
            }
        );
        
        if (error) {
            console.error('❌ Function call failed:', error);
            console.log('Error details:', JSON.stringify(error, null, 2));
        } else {
            console.log('✅ Function call succeeded!');
            console.log('Response data:', JSON.stringify(data, null, 2));
            
            if (data.success) {
                console.log('🎉 Subscription created successfully!');
                console.log('Subscription ID:', data.subscription_id);
                console.log('Customer ID:', data.customer_id);
                console.log('Plan ID:', data.plan_id);
            } else {
                console.log('⚠️ Function returned success: false');
            }
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the test
testDirectSubscriptionFunction();
