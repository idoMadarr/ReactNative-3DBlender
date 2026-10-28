package expo.modules.arplacement

import com.google.ar.core.ArCoreApk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArPlacementModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArPlacement")

    AsyncFunction("getAvailabilityAsync") { promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ArCoreApk.getInstance().checkAvailabilityAsync(context) { availability ->
        promise.resolve(
          when (availability) {
            ArCoreApk.Availability.SUPPORTED_INSTALLED -> "supported"
            // SceneView asks the user to install or update ARCore when the session starts
            ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD,
            ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> "needsInstall"
            ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE -> "unsupported"
            else -> "unknown"
          }
        )
      }
    }

    View(ArPlacementView::class) {
      Events("onTrackingChange", "onModelLoad", "onPlaced", "onError")

      Prop("modelUri") { view: ArPlacementView, uri: String? ->
        view.modelUri = uri
      }

      Prop("modelSize") { view: ArPlacementView, size: Float? ->
        view.modelSize = size ?: 0.5f
      }

      Prop("showPlanes") { view: ArPlacementView, show: Boolean? ->
        view.showPlanes = show ?: true
      }

      AsyncFunction("reset") { view: ArPlacementView ->
        view.reset()
      }
    }
  }
}
