// PairingActivity.kt — User enters the pairing code shown on the web app
package com.operaai.companion

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PairingActivity : AppCompatActivity() {
    private val scope = CoroutineScope(Dispatchers.IO)
    private lateinit var api: OperaApiClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pairing)
        api = OperaApiClient(BuildConfig.OPERA_BASE_URL)

        val prefs = getSharedPreferences("opera", MODE_PRIVATE)
        api.setSessionCookie(prefs.getString("sessionCookie", null))

        val codeInput: EditText = findViewById(R.id.codeInput)
        codeInput.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        val pairBtn: Button = findViewById(R.id.pairBtn)
        val status: TextView = findViewById(R.id.statusText)

        pairBtn.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.length != 8) {
                Toast.makeText(this, "Enter 8-char code", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            pairBtn.isEnabled = false
            status.text = "Pairing…"
            scope.launch {
                try {
                    val res = api.completePairing(
                        pairingCode = code,
                        deviceModel = Build.MODEL,
                        androidVersion = Build.VERSION.RELEASE,
                        fcmToken = null
                    )
                    runOnUiThread {
                        if (res.optBoolean("ok")) {
                            if (res.optBoolean("awaitingApproval")) {
                                status.text = "Paired. Waiting for owner approval on web app…"
                                prefs.edit().putString("deviceId", res.optString("deviceId")).apply()
                                // Start foreground service
                                startService(Intent(this@PairingActivity, CallQueueService::class.java))
                            }
                        } else {
                            status.text = "Pairing failed: ${res.optString("error", "unknown")}"
                            pairBtn.isEnabled = true
                        }
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        status.text = "Network error: ${e.message}"
                        pairBtn.isEnabled = true
                    }
                }
            }
        }
    }
}
