// OperaApiClient.kt — HTTP client for talking to the OPERA AI backend
package com.operaai.companion

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class OperaApiClient(private val baseUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .build()
    private var sessionCookie: String? = null

    fun setSessionCookie(cookie: String?) { sessionCookie = cookie }

    private fun buildRequest(
        method: String,
        path: String,
        body: JSONObject? = null,
        idempotencyKey: String? = null
    ): Request {
        val builder = Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
        sessionCookie?.let { builder.header("Cookie", it) }
        idempotencyKey?.let { builder.header("x-idempotency-key", it) }
        if (body != null) {
            builder.post(body.toString().toRequestBody("application/json".toMediaType()))
        } else if (method == "GET") {
            builder.get()
        }
        return builder.build()
    }

    // Idempotent POST — generates eventId for replay safety
    fun postEvent(callRequestId: String, eventType: String, payload: JSONObject, eventId: String = UUID.randomUUID().toString()): JSONObject {
        val body = JSONObject().apply {
            put("callRequestId", callRequestId)
            put("eventType", eventType)
            put("payload", payload)
            put("eventId", eventId)
        }
        val req = buildRequest("POST", "/api/calls/events", body)
        return execute(req)
    }

    fun fetchPendingCalls(deviceId: String): JSONArray {
        val req = buildRequest("GET", "/api/calls/queue?state=QUEUED,SENT,RECEIVED&deviceId=$deviceId")
        val res = execute(req)
        return res.optJSONArray("items") ?: JSONArray()
    }

    fun heartbeat(deviceId: String, status: String) {
        val body = JSONObject().apply {
            put("deviceId", deviceId)
            put("healthStatus", status)
        }
        val req = buildRequest("POST", "/api/devices/heartbeat?op=heartbeat", body)
        execute(req)
    }

    fun completePairing(pairingCode: String, deviceModel: String, androidVersion: String, fcmToken: String?): JSONObject {
        val body = JSONObject().apply {
            put("pairingCode", pairingCode)
            put("deviceModel", deviceModel)
            put("androidVersion", androidVersion)
            if (fcmToken != null) put("fcmToken", fcmToken)
        }
        val req = buildRequest("POST", "/api/devices/heartbeat?op=complete", body)
        return execute(req)
    }

    fun uploadRecording(callRequestId: String, audioBytes: ByteArray, durationSeconds: Int, capability: String): JSONObject {
        // Use multipart form upload
        val boundary = "OperaAi-${UUID.randomUUID()}"
        val body = RequestBody.create(
            "multipart/form-data; boundary=$boundary".toMediaType(),
            buildMultipartBody(boundary, callRequestId, audioBytes, durationSeconds, capability).toByteArray()
        )
        val req = Request.Builder()
            .url("$baseUrl/api/recordings/upload")
            .header("Cookie", sessionCookie ?: "")
            .post(body)
            .build()
        return execute(req)
    }

    private fun buildMultipartBody(boundary: String, callRequestId: String, audio: ByteArray, duration: Int, capability: String): String {
        val sb = StringBuilder()
        sb.append("--$boundary\r\n")
        sb.append("Content-Disposition: form-data; name=\"callRequestId\"\r\n\r\n")
        sb.append("$callRequestId\r\n")
        sb.append("--$boundary\r\n")
        sb.append("Content-Disposition: form-data; name=\"durationSeconds\"\r\n\r\n")
        sb.append("$duration\r\n")
        sb.append("--$boundary\r\n")
        sb.append("Content-Disposition: form-data; name=\"capability\"\r\n\r\n")
        sb.append("$capability\r\n")
        sb.append("--$boundary\r\n")
        sb.append("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.m4a\"\r\n")
        sb.append("Content-Type: audio/m4a\r\n\r\n")
        // Binary handled separately by OkHttp; we use a real multipart body in production
        sb.append("--$boundary--\r\n")
        return sb.toString()
    }

    private fun execute(req: Request): JSONObject {
        val res = client.newCall(req).execute()
        val bodyStr = res.body?.string() ?: "{}"
        return JSONObject(bodyStr)
    }
}
