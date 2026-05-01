package com.toe.life;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

public class LockScreenActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lock_screen);

        TextView titleView = findViewById(R.id.lockTitle);
        TextView detailView = findViewById(R.id.lockDetail);
        Button backButton = findViewById(R.id.lockBackButton);
        String blockedPackage = getIntent().getStringExtra("blockedPackage");

        titleView.setText("这一轮还没结束");
        detailView.setText(blockedPackage == null || blockedPackage.isEmpty()
            ? "先回到 life，把这轮专注做完。"
            : "当前应用已被专注锁定：" + blockedPackage + "\n先回到 life，把这轮专注做完。");

        backButton.setOnClickListener(view -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
            finish();
        });
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}
