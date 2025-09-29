# Streaming Test Commands

## ✅ Working Tests (confirmed)

### Test Custom Prompts:
```bash
curl -N --no-buffer "http://localhost:10023/wp-admin/admin-ajax.php?action=hello_chatbot_stream_message&message=Who%20is%20Concentrix?&nonce=ef9a42a73a" 2>/dev/null
```

### Test Real API Calls:
```bash
curl -N --no-buffer "http://localhost:10023/wp-admin/admin-ajax.php?action=hello_chatbot_stream_message&message=what%20services%20does%20concentrix%20offer&nonce=ef9a42a73a" 2>/dev/null
```

### Test Different Questions:
```bash
curl -N --no-buffer "http://localhost:10023/wp-admin/admin-ajax.php?action=hello_chatbot_stream_message&message=tell%20me%20about%20concentrix%20careers&nonce=ef9a42a73a" 2>/dev/null
```

## 🧪 Frontend Test Pages:

### Updated Test Page:
- Visit: `http://localhost:10023/wp-content/plugins/cnxc-ix-hello-chatbot/test-frontend-streaming.html`
- This page now dynamically fetches the correct chatbot nonce
- Test both "Custom Prompt" and "API Call" buttons

### Reference Implementation:
- Visit: `http://localhost:10023/wp-content/plugins/cnxc-ix-hello-chatbot/test-streaming.html`
- Shows the ideal streaming behavior to match

## ✅ Verified Working:

1. **Bearer Token**: ✓ Properly configured (API calls returning real data)
2. **Custom Prompts**: ✓ Streaming smoothly with 50ms delays
3. **Real API Calls**: ✓ Connecting to KBot API and streaming responses  
4. **References**: ✓ Included with proper URLs and descriptions
5. **Error Handling**: ✓ Graceful fallbacks and detailed logging
6. **Frontend**: ✓ JSON parsing errors fixed, matches test file behavior

## 🎯 Next Steps:

1. **Test in Browser**: Visit the actual WordPress site and test the chatbot widget
2. **Check Admin**: Ensure Bearer Token is visible in Settings → Hello Chatbot
3. **Live Testing**: Use the chatbot on any page of your WordPress site

The streaming implementation is now complete and working properly! 🚀