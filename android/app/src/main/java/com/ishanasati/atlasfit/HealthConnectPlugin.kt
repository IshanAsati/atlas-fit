package com.ishanasati.atlasfit

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

/** No sensor collection, background reads, writes, persistence, or network calls. */
@CapacitorPlugin(name = "AtlasHealth")
class HealthConnectPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var requestingAccess = false

    // Lazy: do not initialise Health Connect APIs on unsupported Android versions.
    private val stepsPermission by lazy { HealthPermission.getReadPermission(StepsRecord::class) }
    private val distancePermission by lazy { HealthPermission.getReadPermission(DistanceRecord::class) }
    private val caloriesPermission by lazy { HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class) }
    private val readPermissions by lazy { setOf(stepsPermission, distancePermission, caloriesPermission) }
    private val permissionContract by lazy { PermissionController.createRequestPermissionResultContract(PROVIDER) }

    private fun availability(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return "unavailable"
        return when (HealthConnectClient.getSdkStatus(context, PROVIDER)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "install-required"
            else -> "unavailable"
        }
    }

    private fun client(): HealthConnectClient {
        check(availability() == "available") { "Health Connect is not available on this device." }
        return HealthConnectClient.getOrCreate(context, PROVIDER)
    }

    private fun run(call: PluginCall, operation: suspend () -> Unit) {
        scope.launch {
            try {
                operation()
            } catch (error: CancellationException) {
                throw error
            } catch (error: SecurityException) {
                call.reject("Health access changed. Reconnect in Health Connect and refresh.", "HEALTH_PERMISSION_REQUIRED", error)
            } catch (error: Exception) {
                call.reject("Health Connect could not complete this request. Check its availability and try again.", "HEALTH_REQUEST_FAILED", error)
            }
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) = run(call) {
        val status = availability()
        val granted = status == "available" && stepsPermission in client().permissionController.getGrantedPermissions()
        call.resolve(JSObject().put("status", status).put("permissionsGranted", granted))
    }

    /** Only invoked by the explicit Connect / Manage access button. */
    @PluginMethod
    fun requestAccess(call: PluginCall) = run(call) {
        if (availability() != "available") {
            call.resolve(JSObject().put("granted", false))
        } else if (requestingAccess) {
            call.reject("A health access request is already open.", "HEALTH_REQUEST_IN_PROGRESS")
        } else {
            requestingAccess = true
            try {
                // Capacitor registers @ActivityCallback launchers before Activity STARTED.
                // The official contract supplies the correct Android 9–13 / 14+ intent.
                startActivityForResult(call, permissionContract.createIntent(activity, readPermissions), "accessResult")
            } catch (error: Exception) {
                requestingAccess = false
                throw error
            }
        }
    }

    @ActivityCallback
    private fun accessResult(call: PluginCall?, result: ActivityResult) {
        requestingAccess = false
        if (call == null) return
        run(call) {
            permissionContract.parseResult(result.resultCode, result.data)
            // Re-read actual grants; optional permission denial is not a connection failure.
            val granted = availability() == "available" && stepsPermission in client().permissionController.getGrantedPermissions()
            call.resolve(JSObject().put("granted", granted))
        }
    }

    @PluginMethod
    fun getTodaySummary(call: PluginCall) = run(call) {
        val health = client()
        val granted = health.permissionController.getGrantedPermissions()
        if (stepsPermission !in granted) throw SecurityException("Steps read access is required")
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val date = now.atZone(zone).toLocalDate()
        val range = TimeRangeFilter.between(date.atStartOfDay(zone).toInstant(), now)
        // Aggregate handles Health Connect source priorities/deduplication, not raw sums.
        val steps = health.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), range))[StepsRecord.COUNT_TOTAL]
        val distance = if (distancePermission in granted) {
            try {
                health.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), range))[DistanceRecord.DISTANCE_TOTAL]?.inKilometers
            } catch (_: SecurityException) { null }
        } else null
        val calories = if (caloriesPermission in granted) {
            try {
                health.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), range))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
            } catch (_: SecurityException) { null }
        } else null
        call.resolve(JSObject()
            .put("date", date.toString())
            .put("steps", steps ?: JSONObject.NULL)
            .put("distanceKm", distance ?: JSONObject.NULL)
            .put("activeCalories", calories ?: JSONObject.NULL))
    }

    /** No automatic store redirect: this method is called only by a user action. */
    @PluginMethod
    fun openHealthConnect(call: PluginCall) = run(call) {
        when (availability()) {
            "install-required" -> {
                val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$PROVIDER"))
                    .setPackage("com.android.vending")
                try { activity.startActivity(market) }
                catch (_: ActivityNotFoundException) {
                    activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER")))
                }
            }
            "available" -> activity.startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
            else -> {
                call.reject("Health Connect requires Android 9 or later and a supported device.", "HEALTH_UNAVAILABLE")
                return@run
            }
        }
        call.resolve()
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    companion object {
        private const val PROVIDER = "com.google.android.apps.healthdata"
    }
}

/** Standalone rationale works even when opened from Health Connect, outside the web UI. */
class HealthPermissionRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AlertDialog.Builder(this)
            .setTitle("Atlas Fit health privacy")
            .setMessage("Atlas Fit reads today’s steps, distance, and active energy from Health Connect only when you allow access. Steps access is needed; distance and active energy are optional.\n\nThese readings are displayed on your device. Atlas Fit does not save them to its workout database or backups, upload them, or share them. It does not write health records or track sensors in the background.\n\nYou can change or revoke access at any time in Health Connect. Other health apps must record and sync data before Atlas Fit can display it.")
            .setPositiveButton("Done") { _, _ -> finish() }
            .setOnCancelListener { finish() }
            .show()
    }
}
