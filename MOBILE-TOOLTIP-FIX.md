# Mobile Tooltip Fix Documentation

**Date:** 2025-10-15
**Issue:** Tooltips on mobile devices stay visible after tapping instead of disappearing
**Status:** ✅ Fixed

## Problem Description

On mobile devices (iOS Safari, Android Chrome), when users tapped any of the tooltip buttons (info, refresh, minimize, or back), the tooltips would appear but remain stuck on the screen. Users had no way to dismiss them except by closing and reopening the widget.

### Root Causes

1. **Event Listener Mismatch**: The code only used `mouseenter` and `mouseleave` events, which are designed for mouse hover interactions and don't work properly on touch devices
2. **No Touch Event Handlers**: There were no touch-specific event handlers to handle tap interactions
3. **Stuck Hover States**: On mobile, tapping can trigger `mouseenter` but no corresponding `mouseleave` occurs
4. **No Dismiss Mechanism**: There was no way for users to close tooltips after they appeared

## Solution Implementation

### 1. Touch Device Detection

Added a utility method to detect if the device supports touch events:

```javascript
detectTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0);
}
```

This detection is performed once during widget initialization and stored in `this.isTouchDevice`.

### 2. Helper Methods

Added two new helper methods for better tooltip management:

#### `hideAllTooltips()`
Hides all tooltips at once - useful when clicking outside or switching between tooltips:

```javascript
hideAllTooltips() {
    this.hideInfoTooltip();
    this.hideRefreshTooltip();
    this.hideMinimizeTooltip();
    this.hideBackTooltip();
}
```

#### `toggleTooltip(type)`
Toggles a specific tooltip's visibility and hides all others:

```javascript
toggleTooltip(type) {
    // Hide all other tooltips first
    const tooltips = ['info', 'refresh', 'minimize', 'back'];
    tooltips.forEach(t => {
        if (t !== type) {
            const methodName = `hide${t.charAt(0).toUpperCase() + t.slice(1)}Tooltip`;
            if (this[methodName]) {
                this[methodName]();
            }
        }
    });

    // Toggle the requested tooltip
    const showKey = `show${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
    const isCurrentlyShown = this.state[showKey];

    if (isCurrentlyShown) {
        const methodName = `hide${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
        this[methodName]();
    } else {
        const methodName = `show${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
        this[methodName]();
    }
}
```

### 3. Conditional Event Listeners

Modified event listener attachment to use different strategies based on device type:

**Touch Devices (Mobile/Tablet):**
- Use `click` events to toggle tooltips
- Call `e.stopPropagation()` to prevent event bubbling

**Non-Touch Devices (Desktop):**
- Use `mouseenter` to show tooltips
- Use `mouseleave` to hide tooltips

Example implementation:

```javascript
const infoWrapper = document.querySelector('.chatbot-info-wrapper');
if (infoWrapper) {
    if (this.isTouchDevice) {
        // On touch devices, toggle tooltip on click
        infoWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTooltip('info');
        });
    } else {
        // On desktop, show on hover
        infoWrapper.addEventListener('mouseenter', () => this.showInfoTooltip());
        infoWrapper.addEventListener('mouseleave', () => this.hideInfoTooltip());
    }
}
```

This pattern was applied to all four tooltip wrappers:
- `.chatbot-info-wrapper`
- `.chatbot-refresh-wrapper`
- `.chatbot-minimize-wrapper`
- `.chatbot-back-wrapper`

### 4. Document-Level Click Handler

Added a global click handler for touch devices to close tooltips when tapping outside:

```javascript
if (this.isTouchDevice) {
    document.addEventListener('click', (e) => {
        // Check if any tooltip is currently shown
        const hasTooltipShown = this.state.showInfoTooltip ||
                              this.state.showRefreshTooltip ||
                              this.state.showMinimizeTooltip ||
                              this.state.showBackTooltip;

        if (hasTooltipShown) {
            // Check if click is outside all tooltip wrappers and tooltips
            const clickedInsideWrapper = e.target.closest('.chatbot-info-wrapper') ||
                                        e.target.closest('.chatbot-refresh-wrapper') ||
                                        e.target.closest('.chatbot-minimize-wrapper') ||
                                        e.target.closest('.chatbot-back-wrapper');

            const clickedInsideTooltip = e.target.closest('.chatbot-info-tooltip') ||
                                         e.target.closest('.chatbot-refresh-tooltip') ||
                                         e.target.closest('.chatbot-minimize-tooltip') ||
                                         e.target.closest('.chatbot-back-tooltip');

            // If clicked outside, hide all tooltips
            if (!clickedInsideWrapper && !clickedInsideTooltip) {
                this.hideAllTooltips();
            }
        }
    });
}
```

### 5. Button Action Auto-Hide

Updated button action handlers to hide tooltips when their actions are executed:

```javascript
// Minimize button
this.elements.minimizeBtn?.addEventListener('click', () => {
    this.hideMinimizeTooltip();
    this.closeChat();
});

// Refresh button
this.elements.refreshBtn?.addEventListener('click', () => {
    this.hideRefreshTooltip();
    this.startNewChat();
});

// Back button
this.elements.backBtn?.addEventListener('click', () => {
    this.hideBackTooltip();
    this.switchToListView();
});
```

### 6. Dual Event Listener Locations

Changes were applied in two locations in the code:

1. **Initial Attachment** (~line 440-508): When the widget first loads
2. **Reattachment** (~line 1454-1516): After view transitions (chat ↔ list)

This ensures tooltips work correctly even after switching between chat and list views.

## Files Modified

- **`assets/js/chatbot.js`**
  - Added `detectTouchDevice()` method (~line 61-65)
  - Added `hideAllTooltips()` method (~line 670-675)
  - Added `toggleTooltip(type)` method (~line 680-703)
  - Updated event listeners in `attachEventListeners()` (~line 440-572)
  - Updated event listeners in view transition handler (~line 1454-1516)
  - Updated button action handlers (~line 437-444, 511-514, 1459-1470)

## Behavior Summary

| Device Type | Tooltip Show | Tooltip Hide |
|------------|-------------|--------------|
| **Touch (Mobile/Tablet)** | Tap wrapper/button | Tap again, tap outside, or perform action |
| **Desktop (Mouse)** | Hover over wrapper | Move mouse away from wrapper |

## Testing Checklist

### Mobile Devices (iOS Safari, Android Chrome)
- [x] Tap info button - tooltip appears
- [x] Tap info button again - tooltip disappears
- [x] Tap info button, then tap outside - tooltip disappears
- [x] Tap refresh button - tooltip appears/disappears
- [x] Tap minimize button - tooltip appears/disappears
- [x] Tap back button - tooltip appears/disappears
- [x] Show one tooltip, tap another button - first hides, second shows
- [x] Tap button to perform action - tooltip hides AND action executes

### Desktop (Chrome, Firefox, Safari)
- [x] Hover over info button - tooltip appears
- [x] Move mouse away - tooltip disappears
- [x] Hover behavior works for all buttons
- [x] No click-to-toggle (hover-only)

## Known Issues Fixed

| Before | After |
|--------|-------|
| ❌ Tooltips stayed visible after tapping | ✅ Can be dismissed by tapping again or outside |
| ❌ Only `mouseenter`/`mouseleave` (don't work on touch) | ✅ Touch uses click, desktop uses hover |
| ❌ No way to close tooltip except closing widget | ✅ Multiple dismiss methods available |

## Related Documentation

- `test-mobile-tooltip-fix.html` - Interactive test page for manual testing
- `CLAUDE.md` - Project documentation with architecture details

## Developer Notes

- The touch detection happens once at widget initialization
- Event listeners are attached conditionally based on device type
- The same event listener logic exists in two places (initial + reattachment)
- Always test after view transitions (chat ↔ list) to ensure tooltips still work
- Desktop behavior is unchanged - hover still works as before
