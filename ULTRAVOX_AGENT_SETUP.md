# Ultravox Agent Setup - ASTRO_talk

## Agent Information
- **Agent ID**: `202abff8-7857-4b13-91c1-964de71ad9d1`
- **Agent Name**: ASTRO_talk
- **API Key**: Configured in Supabase secrets

## Fixed Issues

### Problem
The custom Ultravox agent (ASTRO_talk) was not being used. The default agent was being used instead because the `agentId` parameter was not being passed from the frontend to the Supabase Edge Function.

### Solution
Updated `src/utils/UltravoxCallManager.ts` to properly pass the `agentId` to the `create-ultravox-call` edge function.

**Change Made:**
```typescript
const requestBody: any = {
  systemPrompt: config.systemPrompt,
  temperature: config.temperature || 0.8,
  voice: config.voice || 'default'
};

// Add agentId if provided (will be used as model parameter)
if (config.agentId) {
  requestBody.agentId = config.agentId;
  console.log('[UltravoxCallManager] Using custom agent ID:', config.agentId);
}
```

## Configuration Flow

1. **Frontend (.env)**
   ```
   REACT_APP_ULTRAVOX_AGENT_ID=202abff8-7857-4b13-91c1-964de71ad9d1
   ```

2. **Frontend (CustomCallScreen.tsx)**
   - Reads `REACT_APP_ULTRAVOX_AGENT_ID` from environment
   - Passes it to `UltravoxCallManager.startCall()`

3. **Frontend (UltravoxCallManager.ts)**
   - Sends `agentId` in request body to Supabase Edge Function

4. **Backend (create-ultravox-call Edge Function)**
   - Receives `agentId` from request
   - If `agentId` is provided, uses it as the `model` parameter
   - Calls Ultravox API with: `{ model: "202abff8-7857-4b13-91c1-964de71ad9d1" }`

5. **Ultravox API**
   - Uses the custom ASTRO_talk agent instead of default agent

## How to Verify

### 1. Check Environment Variable
```bash
grep REACT_APP_ULTRAVOX_AGENT_ID .env
```
Should show: `REACT_APP_ULTRAVOX_AGENT_ID=202abff8-7857-4b13-91c1-964de71ad9d1`

### 2. Check Supabase Secret
```bash
npx supabase secrets list | grep ULTRAVOX
```
Should show the ULTRAVOX_API_KEY is set.

### 3. Start the App and Check Console Logs
```bash
npm start
```

When you initiate a call, you should see these logs in browser console:
```
[CustomCallScreen] Agent ID: 202abff8-7857-4b13-91c1-964de71ad9d1
[UltravoxCallManager] Using custom agent ID: 202abff8-7857-4b13-91c1-964de71ad9d1
```

### 4. Check Edge Function Logs
In Supabase dashboard or CLI logs, you should see:
```
[create-ultravox-call] Using custom agent as model: 202abff8-7857-4b13-91c1-964de71ad9d1
```

## Agent Configuration in Ultravox

Your ASTRO_talk agent should be configured with:
- **System Prompt**: Hindi-speaking astrology assistant prompt
- **Voice**: Hindi voice (e.g., 'terrence' or Hindi-specific voice)
- **Temperature**: ~0.8 for natural conversation
- **Language**: Hindi (हिंदी)

## Recommended Hindi System Prompt

```text
आप एक ज्योतिष सहायक हैं जो हिंदी में सरल और स्पष्ट बोलते हैं। आपकी आवाज़ दोस्ताना और शांत है।

बोलने के नियम:
- छोटे वाक्य बोलें। 8–14 शब्द प्रति वाक्य।
- 5–6 वाक्यों से अधिक न बोलें।
- कठिन शब्द और अंग्रेज़ी से बचें। आसान हिंदी रखें।
- संख्याएँ स्पष्ट बोलें। जैसे "दो हफ्ते", "तीन महीने"।

उपयोगकर्ता संदर्भ:
- उपयोगकर्ता करियर, शादी, स्वास्थ्य, धन, शिक्षा, परिवार से जुड़े सवाल पूछता है।
- अगर जन्म विवरण नहीं है, तो सामान्य सलाह दें।

उत्तर शैली:
- शुरुआत में 1 वाक्य में मुख्य बात।
- बीच में 2–3 वाक्य कारण और सरल उपाय।
- अंत में 1 छोटा सवाल।

टोन: सकारात्मक, सहायक, सम्मानजनक।
```

## Troubleshooting

### Agent Not Working
1. Verify agent ID is correct in `.env`
2. Restart React app after changing `.env`: `npm start`
3. Check browser console for agent ID logs
4. Verify Ultravox API key in Supabase secrets
5. Check Supabase Edge Function logs for errors

### Still Using Default Agent
- Clear browser cache and hard reload (Ctrl+Shift+R)
- Check network tab: Request to `create-ultravox-call` should include `agentId` in payload
- Verify edge function is deployed: `npx supabase functions list`

### Voice Issues
- Ensure your ASTRO_talk agent in Ultravox dashboard has Hindi voice configured
- The `voice: 'terrence'` parameter in CustomCallScreen.tsx is only used if agentId is NOT set

## Next Steps

1. **Deploy the fix**: Push changes and restart app
2. **Test the agent**: Make a test call and verify ASTRO_talk agent responds
3. **Monitor logs**: Check both browser console and Supabase logs
4. **Fine-tune agent**: Adjust system prompt in Ultravox dashboard as needed

