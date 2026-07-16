# Agora Integration Debugging Guide

## Common Issues & Solutions

### Issue 1: Agora Call Not Starting
**Symptoms:** Agora button works but call never connects

**Root Causes:**
1. **Missing Environment Variables**
   - AGORA_APP_ID not set
   - AGORA_CUSTOMER_ID not set  
   - AGORA_CUSTOMER_SECRET not set
   - OPENAI_API_KEY not set (for Realtime MLLM)

2. **Token Generation Failing**
   - generate-agora-token function timing out
   - Missing AGORA_APP_CERTIFICATE in secrets

3. **Channel Connection Issues**
   - Cannot join Agora RTC channel
   - Token validation failing
   - Network/firewall blocking

4. **AI Agent Not Joining**
   - manage-agora-ai API call failing
   - Wrong channel name format
   - Agora API credentials wrong

### Issue 2: No Audio/Connection Problems
**Symptoms:** Call connects but no audio or AI not responding

**Likely Causes:**
- Microphone permissions not granted
- Browser security blocking audio access
- Agora RTC credentials invalid
- OpenAI Realtime API not responding

### Issue 3: Error Handling Not Working
**Symptoms:** Errors not showing properly

**Check:**
- AICallScreen error state rendering
- Proper error message extraction from response

## Debugging Steps

### Step 1: Check Browser Console (F12)
Look for:
```
[AgoraManager] ❌ An error occurred during the connection process
[AICallScreen] Call failed
```

### Step 2: Verify Supabase Secrets
In Supabase Dashboard → Settings → Edge Functions → Secrets:
- [ ] AGORA_APP_ID
- [ ] AGORA_APP_CERTIFICATE  
- [ ] AGORA_CUSTOMER_ID
- [ ] AGORA_CUSTOMER_SECRET
- [ ] OPENAI_API_KEY

### Step 3: Check Function Logs
In Supabase Dashboard → Functions → Function Invocations:
1. Check `generate-agora-token` logs
2. Check `manage-agora-ai` logs
3. Check `initiate-ai-call` logs

### Step 4: Test Token Generation Manually
```javascript
// In browser console:
const response = await fetch('https://your-supabase-url/functions/v1/generate-agora-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ channelName: 'test-channel' })
});
const data = await response.json();
console.log(data);
```

## Key Code Locations

| Component | Location | Issue Type |
|-----------|----------|-----------|
| AICallScreen | src/components/AICallScreen.tsx | UI rendering |
| AgoraManager | src/utils/AgoraManager.ts | RTC connection |
| Token Generation | supabase/functions/generate-agora-token | Token creation |
| AI Agent Setup | supabase/functions/manage-agora-ai | Agent initialization |
| Provider Selection | src/hooks/useCallProvider.ts | Wrong provider being set |

## Recent Changes Impact

The recent CustomCallScreen changes should NOT affect Agora, but check:
- [ ] ChatPage.tsx still correctly switches between Ultravox and Agora
- [ ] selectedCallProvider state properly updated
- [ ] No CSS conflicts affecting AICallScreen

## Quick Fixes to Try

1. **Clear Browser Cache**
   ```bash
   Hard refresh: Ctrl+Shift+R (Linux/Windows) or Cmd+Shift+R (Mac)
   ```

2. **Verify Provider Setting in DB**
   ```sql
   SELECT * FROM provider_settings WHERE setting_key = 'default_call_provider';
   ```

3. **Check if Agora SDK is Loaded**
   ```javascript
   // In browser console:
   console.log(typeof AgoraRTC);
   // Should print: object (not undefined)
   ```

4. **Enable Debug Logging**
   Add this to AgoraManager.ts top level:
   ```typescript
   AgoraRTC.enableLogUpload();
   ```

## Testing Checklist

- [ ] Open browser DevTools (F12)
- [ ] Go to Chat page
- [ ] Select a profile
- [ ] Click the Voice Call button
- [ ] Choose Agora provider (if prompted)
- [ ] Wait 3-5 seconds for connection
- [ ] Check console for [AgoraManager] logs
- [ ] Verify microphone permission is allowed
- [ ] Check if you hear the AI response

## Still Not Working?

1. Check Supabase function logs for exact error
2. Verify all environment variables are set
3. Ensure Agora account is active and not rate-limited
4. Check firewall/network blocking WebRTC
5. Try switching to Ultravox to confirm app works
6. Check browser compatibility (Chrome recommended)
