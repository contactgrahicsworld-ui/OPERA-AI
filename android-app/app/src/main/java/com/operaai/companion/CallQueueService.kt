// CallQueueService.kt — Foreground service that polls for queued calls
// and uses Android Telecom API to place real cellular calls via SIM
package com.operaai.companion

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.telecom.TelecomManager
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

class CallQueueService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private lateinit var api: OperaApiClient
    private var deviceId: String = ""
    private val activeCalls = ConcurrentHashMap<String, Boolean>()

    override fun onCreate() {
        super.onCreate()
        api = OperaApiClient(BuildConfig.OPERA_BASE_URL)
        val prefs = getSharedPreferences("opera", MODE_PRIVATE)
        api.setSessionCookie(prefs.getString("sessionCookie", null))
        deviceId = prefs.getString("deviceId", "") ?: ""
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundWithNotification()
        scope.launch {
            while (true) {
                try {
                    pollForCalls()
                } catch (e: Exception) {
                    Log.e(TAG, "poll failed", e)
                }
                delay(POLL_INTERVAL_MS)
            }
        }
        return START_STICKY
    }

    private fun pollForCalls() {
        if (deviceId.isBlank()) return
        val items = api.fetchPendingCalls(deviceId)
        for (i in 0 until items.length()) {
            val cr = items.getJSONObject(i)
            val crId = cr.getString("id")
            val state = cr.getString("state")
            val phone = cr.getString("phoneNumber")
            if (activeCalls[crId] == true) continue
            activeCalls[crId] = true
            handleCall(crId, state, phone)
        }
    }

    private fun handleCall(crId: String, state: String, phone: String) {
        when (state) {
            "QUEUED" -> {
                api.postEvent(crId, "SENT", JSONObject().apply { put("sentAt", System.currentTimeMillis()) })
            }
            "SENT", "RECEIVED" -> {
                placeRealCall(crId, phone)
            }
        }
    }

    // REAL cellular call via Android TelecomManager — uses physical SIM/eSIM
    private fun placeRealCall(crId: String, phone: String) {
        try {
            api.postEvent(crId, "DIALING", JSONObject())
            val telecom = getSystemService(TELECOM_SERVICE) as TelecomManager
            // Note: requires android.permission.CALL_PHONE (declared in manifest)
            // For production: use PhoneAccount registered via TelecomManager.registerPhoneAccount
            // to place the call programmatically as the SIM account.
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = android.net.Uri.parse("tel:$phone")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            api.postEvent(crId, "RINGING", JSONObject())
            // Subsequent CONNECTED + ENDED events would be detected via PhoneStateListener
            // (omitted for brevity — full implementation in CallStateReceiver.kt)
        } catch (e: SecurityException) {
            api.postEvent(crId, "FAILED", JSONObject().apply { put("reason", "permission_denied") })
            activeCalls[crId] = false
        }
    }

    private fun startForegroundWithNotification() {
        val notif: Notification = NotificationCompat.Builder(this, OperaAiApplication.CHANNEL_FOREGROUND)
            .setContentTitle("OPERA AI")
            .setContentText("Monitoring call queue")
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.coroutineContext[Job]?.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "CallQueueService"
        private const val POLL_INTERVAL_MS = 5_000L
        private const val NOTIF_ID = 42
    }
}
