package com.toe.life;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "FocusLock")
public class FocusLockPlugin extends Plugin {
    static final String PREFS_NAME = "life_focus_lock";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_ACTIVE = "active";
    static final String KEY_UNTIL = "until_timestamp";
    static final String KEY_BLOCKED = "blocked_packages";

    @PluginMethod
    public void saveConfig(PluginCall call) {
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSArray blockedPackages = call.getArray("blockedPackages");
        Set<String> packages = new HashSet<>();

        if (blockedPackages != null) {
            for (int index = 0; index < blockedPackages.length(); index++) {
                String packageName = blockedPackages.optString(index, "");
                if (!packageName.isEmpty()) {
                    packages.add(packageName);
                }
            }
        }

        preferences.edit()
            .putBoolean(KEY_ENABLED, call.getBoolean("enabled", false))
            .putBoolean(KEY_ACTIVE, call.getBoolean("active", false))
            .putLong(KEY_UNTIL, call.getLong("untilTimestamp", 0L))
            .putStringSet(KEY_BLOCKED, packages)
            .apply();

        call.resolve();
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("serviceEnabled", isAccessibilityServiceEnabled());
        call.resolve(result);
    }

    private boolean isAccessibilityServiceEnabled() {
        String enabledServices = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabledServices == null) {
            return false;
        }

        ComponentName componentName = new ComponentName(getContext(), FocusLockAccessibilityService.class);
        return enabledServices.contains(componentName.flattenToString());
    }
}
