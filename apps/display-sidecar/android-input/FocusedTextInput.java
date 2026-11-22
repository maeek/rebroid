package io.rebroid.input;

import android.os.Bundle;
import android.text.TextUtils;
import android.util.Base64;
import android.view.accessibility.AccessibilityNodeInfo;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import java.nio.charset.StandardCharsets;

// Loaded by the device's uiautomator runner without installing an APK or switching IMEs.
public final class FocusedTextInput extends UiAutomatorTestCase {
    private static final class FocusedField extends UiObject {
        FocusedField() {
            super(new UiSelector().focused(true));
        }

        AccessibilityNodeInfo current() {
            return findAccessibilityNodeInfo(0);
        }
    }

    public void testInsert() {
        String input = new String(Base64.decode(getParams().getString("text"), Base64.DEFAULT),
                StandardCharsets.UTF_8);
        AccessibilityNodeInfo field = new FocusedField().current();
        assertTrue("No focused editable field", field != null && field.isEditable() && field.isEnabled());
        assertTrue("Cannot read a masked field safely", !field.isPassword());
        CharSequence contents = field.getText();
        String original = field.isShowingHintText() || contents == null ? "" : contents.toString();
        int start = original.isEmpty() ? 0 : field.getTextSelectionStart();
        int end = original.isEmpty() ? 0 : field.getTextSelectionEnd();
        assertTrue("Unknown field selection", start >= 0 && end >= 0
                && start <= original.length() && end <= original.length());
        int left = Math.min(start, end);
        int right = Math.max(start, end);
        String replacement = original.substring(0, left) + input + original.substring(right);
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, replacement);
        assertTrue("Field rejected text", field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args));
        assertTrue("Field contents could not be verified",
                field.refresh() && TextUtils.equals(field.getText(), replacement));
        if (right < original.length()) {
            int cursor = left + input.length();
            Bundle selection = new Bundle();
            selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, cursor);
            selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, cursor);
            assertTrue("Field rejected cursor position",
                    field.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, selection));
        }
        System.out.println("REBROID_TEXT_INSERTED");
    }
}
