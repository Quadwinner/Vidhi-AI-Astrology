# How to Test Category Tracking Locally

## ✅ Step 1: Category Detection Test (PASSED)

The category detection logic is working correctly. All test cases passed.

## 🧪 Step 2: Test in Browser

### Prerequisites
1. Make sure CleverTap is configured in `.env`:
   ```
   REACT_APP_CLEVERTAP_ACCOUNT_ID=4W9-979-K67Z
   REACT_APP_CLEVERTAP_REGION=global
   ```

2. Start the development server:
   ```bash
   npm start
   ```

### Testing Steps

1. **Open Browser DevTools** (F12)
   - Go to **Console** tab
   - Go to **Network** tab
   - Filter by "clevertap" or "api.clevertap"

2. **Check CleverTap Initialization**
   - Look for console logs:
     ```
     [CleverTap] ✅ Initialized successfully
     [CleverTap] Account ID: 4W9-979-K67Z Region: eu1
     [CleverTap] ✅ Test event sent successfully
     ```

3. **Send a Test Question**
   - Log in to the website
   - Select a profile
   - Send a test question like: "Will I find love this year?"

4. **Verify Events in Console**
   - Look for logs:
     ```
     [Analytics] ✅ CleverTap event tracked: Chat Message Sent {question_category: "Love", ...}
     [Analytics] ✅ CleverTap event tracked: Chat Question - Love {category: "Love", ...}
     ```

5. **Verify Network Requests**
   - In Network tab, look for requests to:
     - `clevertap.com/a` (Web SDK)
     - `api.clevertap.com` (API calls)
   - Check the request payload contains:
     - Event name: `Chat Message Sent` or `Chat Question - Love`
     - Properties: `question_category`, `category`, etc.

## 📊 Step 3: Test Different Categories

Send test questions for each category:

| Category | Test Question | Expected Event |
|----------|--------------|----------------|
| Love | "Will I find love?" | `Chat Question - Love` |
| Marriage | "When will I get married?" | `Chat Question - Marriage` |
| Career | "What about my career?" | `Chat Question - Career` |
| Health | "Will I have good health?" | `Chat Question - Health` |
| Money | "How will my finances be?" | `Chat Question - Money` |
| Spiritual | "What is my spiritual purpose?" | `Chat Question - Spiritual` |
| Default | "Hello" | No category-specific event |

## 🔍 Step 4: Verify in CleverTap Dashboard

1. Go to CleverTap Dashboard → Events
2. Wait 10-30 seconds after sending a question
3. Look for events:
   - `Chat Message Sent` (should have `question_category` property)
   - `Chat Question - {Category}` (for categorized questions)

## 🐛 Troubleshooting

### Issue: No CleverTap logs in console
**Check:**
- Is `REACT_APP_CLEVERTAP_ACCOUNT_ID` set in `.env`?
- Did you restart the dev server after adding env vars?
- Check console for initialization errors

### Issue: Events not appearing in CleverTap
**Check:**
- Network tab: Are requests to CleverTap API successful?
- Console: Any error messages?
- CleverTap Dashboard: Wait 10-30 seconds (events are batched)

### Issue: Category always "default"
**Check:**
- Is the question text being passed correctly?
- Try questions with clear keywords (love, marriage, career, etc.)
- Check console for category detection logs

## ✅ Expected Console Output

When you send "Will I find love this year?":

```
[Analytics] ✅ CleverTap event tracked: Chat Message Sent {
  source: "User Input",
  profile_id: "...",
  message_length: 28,
  question_category: "Love"
}

[Analytics] ✅ CleverTap event tracked: Chat Question - Love {
  question_text: "Will I find love this year?",
  category: "Love",
  profile_id: "...",
  source: "User Input"
}
```

## 🎯 Quick Test Checklist

- [ ] Dev server running (`npm start`)
- [ ] Browser DevTools open (Console + Network tabs)
- [ ] CleverTap initialized (check console logs)
- [ ] User logged in and profile selected
- [ ] Send test question: "Will I find love?"
- [ ] See `Chat Message Sent` event in console
- [ ] See `Chat Question - Love` event in console
- [ ] See network requests to CleverTap API
- [ ] Verify events appear in CleverTap Dashboard (after 10-30 seconds)



