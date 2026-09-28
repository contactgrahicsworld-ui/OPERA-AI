// OperaAiApplication.kt — Android companion app entry point
package com.operaai.companion

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class OperaAiApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_CALL_QUEUE,
                    "Call Queue",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Notifies when a call is queued for this device" }
            )
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_FOREGROUND,
                    "Foreground Service",
                    NotificationManager.IMPORTANCE_LOW
                ).apply { description = "Keeps the call queue service alive" }
            )
        }
    }

    companion object {
        lateinit var instance: OperaAiApplication
            private set
        const val CHANNEL_CALL_QUEUE = "call_queue"
        const val CHANNEL_FOREGROUND = "foreground_service"
    }
}
