package com.toe.life;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import java.util.Collections;
import java.util.Set;

public class FocusLockAccessibilityService extends AccessibilityService {
    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        SharedPreferences preferences = getSharedPreferences(FocusLockPlugin.PREFS_NAME, MODE_PRIVATE);
        boolean enabled = preferences.getBoolean(FocusLockPlugin.KEY_ENABLED, false);
        boolean active = preferences.getBoolean(FocusLockPlugin.KEY_ACTIVE, false);
        long untilTimestamp = preferences.getLong(FocusLockPlugin.KEY_UNTIL, 0L);
        Set<String> blockedPackages = preferences.getStringSet(FocusLockPlugin.KEY_BLOCKED, Collections.emptySet());
        String packageName = event.getPackageName().toString();

        if (!enabled || !active || System.currentTimeMillis() > untilTimestamp) {
            return;
        }

        if (packageName.equals(getPackageName()) || !blockedPackages.contains(packageName)) {
            return;
        }

        Intent intent = new Intent(this, LockScreenActivity.class);
        intent.putExtra("blockedPackage", packageName);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS | Intent.FLAG_ACTIVITY_NO_HISTORY);
        startActivity(intent);
    }

    @Override
    public void onInterrupt() {
        // no-op
    }
}
