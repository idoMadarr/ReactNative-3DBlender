package expo.modules.arplacement

import android.content.Context
import android.net.Uri
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.IntSize
import com.google.ar.core.Anchor
import com.google.ar.core.Config
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode as AnchorNodeImpl
import io.github.sceneview.ar.placementHit
import io.github.sceneview.loaders.ModelLoader
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.math.Scale
import io.github.sceneview.math.Size
import io.github.sceneview.model.ModelInstance
import io.github.sceneview.node.Node as NodeImpl
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelLoader
import io.github.sceneview.rememberOnGestureListener
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.max

// Placed models drop in from above with a twist and a slight overshoot
private const val INTRO_SECONDS = 0.7f
private const val INTRO_DROP = 0.3f // share of the model size
private const val INTRO_TWIST = 90f // degrees

private fun easeOutCubic(t: Float) = 1 - (1 - t) * (1 - t) * (1 - t)
private fun easeOutBack(t: Float): Float {
  val u = t - 1
  return 1 + 2.7f * u * u * u + 1.7f * u * u
}

/** A model placed on a surface; a new id means a fresh model instance */
private class Placement(val id: Int, val anchor: Anchor)

class ArPlacementView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // React Native doesn't lay out native children, so the Compose host measures itself
  override val shouldUseAndroidLayout = true

  private val onTrackingChange by EventDispatcher()
  private val onModelLoad by EventDispatcher()
  private val onPlaced by EventDispatcher()
  private val onError by EventDispatcher()

  var modelUri by mutableStateOf<String?>(null)
  var modelSize by mutableFloatStateOf(0.5f)
  var showPlanes by mutableStateOf(true)

  private var placement by mutableStateOf<Placement?>(null)
  private var placementCount = 0
  // Bumped on every placement or move, to replay the intro
  private var placeTick by mutableIntStateOf(0)
  // Lets a later tap move the placed model instead of placing a second one
  private var anchorNode: AnchorNodeImpl? = null
  // Parent of the model that the intro animates, so gestures on the model stay separate
  private var introNode: NodeImpl? = null
  private var latestFrame: Frame? = null
  private var trackingState: String? = null

  init {
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent { Scene() }
      },
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    )
  }

  fun reset() {
    post {
      anchorNode?.detachAnchor()
      anchorNode = null
      introNode = null
      placement = null
    }
  }

  private fun place(anchor: Anchor) {
    val node = anchorNode
    if (node != null) {
      // Setting a new anchor detaches the old one
      node.anchor = anchor
    } else {
      placement = Placement(++placementCount, anchor)
    }
    placeTick++
    onPlaced(mapOf())
  }

  private fun emitTracking(state: String, reason: String? = null) {
    val key = "$state:$reason"
    if (key == trackingState) return
    trackingState = key
    onTrackingChange(if (reason != null) mapOf("state" to state, "reason" to reason) else mapOf("state" to state))
  }

  private fun updateTracking(session: Session, frame: Frame) {
    val camera = frame.camera
    val failure = camera.trackingFailureReason
    when {
      // While ARCore is still starting up it isn't tracking yet, but nothing is wrong
      camera.trackingState != TrackingState.TRACKING && failure != TrackingFailureReason.NONE ->
        emitTracking("limited", failure.name.lowercase())
      camera.trackingState != TrackingState.TRACKING -> emitTracking("searching")
      session.getAllTrackables(Plane::class.java).any {
        it.trackingState == TrackingState.TRACKING && it.subsumedBy == null
      } -> emitTracking("ready")
      else -> emitTracking("searching")
    }
  }

  @Composable
  private fun Scene() {
    val engine = rememberEngine()
    val modelLoader = rememberModelLoader(engine)
    val materialLoader = rememberMaterialLoader(engine)
    val uri = modelUri
    val current = placement
    var viewportSize by remember { mutableStateOf(IntSize.Zero) }

    val reticleMaterial = remember(materialLoader) {
      materialLoader.createUnlitColorInstance(Color(0x99FFFFFF))
    }
    // Draws only the shadows falling on it; SceneView's own surface grid uses it too
    val shadowMaterial = remember(materialLoader) {
      materialLoader.createInstance(
        materialLoader.createMaterial("materials/plane_renderer_shadow.filamat")
      )
    }

    // The raw .glb, kept so every placement can build its own instance: removing a
    // model node destroys the instance it showed
    val modelBytes by produceState<ByteArray?>(null, uri) {
      value = null
      if (uri == null) return@produceState
      value = withContext(Dispatchers.IO) {
        runCatching { File(Uri.parse(uri).path ?: uri).readBytes() }
      }.onFailure {
        onError(mapOf("message" to "Couldn't read model: ${it.message}"))
      }.getOrNull()
      if (value != null) onModelLoad(mapOf())
    }

    ARSceneView(
      modifier = Modifier.fillMaxSize().onSizeChanged { viewportSize = it },
      engine = engine,
      modelLoader = modelLoader,
      materialLoader = materialLoader,
      // The grid only helps while looking for a surface
      planeRenderer = showPlanes && current == null,
      planeFindingMode = Config.PlaneFindingMode.HORIZONTAL,
      onSessionUpdated = { session, frame ->
        latestFrame = frame
        updateTracking(session, frame)
      },
      onSessionFailed = { exception ->
        onError(mapOf("message" to (exception.message ?: exception.javaClass.simpleName)))
      },
      onGestureListener = rememberOnGestureListener(
        onSingleTapConfirmed = { event, node ->
          // Taps on the model are gestures on it, not new placements
          if (node != null) return@rememberOnGestureListener
          val frame = latestFrame ?: return@rememberOnGestureListener
          // The first placement lands on the reticle; later taps move the model there
          val hits = if (placement == null) {
            frame.hitTest(viewportSize.width / 2f, viewportSize.height / 2f)
          } else {
            frame.hitTest(event)
          }
          placementHit(frame, hits, instantPlacement = false)?.let { place(it.createAnchor()) }
        }
      )
    ) {
      // Shows where the model will land, following the surface at the screen center
      if (current == null && viewportSize != IntSize.Zero) {
        val centerX = viewportSize.width / 2f
        val centerY = viewportSize.height / 2f
        HitResultNode(
          hitTest = { frame ->
            placementHit(frame, frame.hitTest(centerX, centerY), instantPlacement = false)
          }
        ) {
          CylinderNode(
            radius = 0.08f,
            height = 0.004f,
            sideCount = 48,
            materialInstance = reticleMaterial
          )
        }
      }

      val bytes = modelBytes
      if (current != null && bytes != null) {
        key(current.id) {
          val instance = remember(bytes) { createInstance(modelLoader, bytes) }
          if (instance != null) {
            AnchorNode(
              anchor = current.anchor,
              apply = { anchorNode = this }
            ) {
              PlaneNode(
                size = Size(modelSize * 3f),
                materialInstance = shadowMaterial,
                apply = {
                  isShadowReceiver = true
                  isShadowCaster = false
                }
              )
              Node(apply = { introNode = this }) {
                ModelNode(
                  modelInstance = instance,
                  scaleToUnits = modelSize,
                  position = groundedOffset(instance, modelSize),
                  isEditable = true,
                  apply = { isShadowCaster = true }
                )
              }
            }
            LaunchedEffect(placeTick) {
              introNode?.let { playIntro(it, modelSize) }
            }
          }
        }
      }
    }
  }

  private suspend fun playIntro(node: NodeImpl, size: Float) {
    val start = withFrameNanos { it }
    var progress = 0f
    while (progress < 1f) {
      progress = ((withFrameNanos { it } - start) / 1e9f / INTRO_SECONDS).coerceAtMost(1f)
      val remaining = 1 - easeOutCubic(progress)
      node.position = Position(0f, size * INTRO_DROP * remaining, 0f)
      node.rotation = Rotation(0f, -INTRO_TWIST * remaining, 0f)
      node.scale = Scale(max(easeOutBack(progress), 0.001f))
    }
  }

  private fun createInstance(
    modelLoader: ModelLoader,
    bytes: ByteArray
  ): ModelInstance? = runCatching {
    // Filament reads the model straight from native memory
    val buffer = ByteBuffer.allocateDirect(bytes.size).put(bytes).apply { flip() }
    modelLoader.createModelInstance(buffer)
  }.onFailure {
    onError(mapOf("message" to "Couldn't load model: ${it.message}"))
  }.getOrNull()

  /** Shifts the scaled model so its bounding box is centered and rests on the anchor */
  private fun groundedOffset(instance: ModelInstance, size: Float): Position {
    val box = instance.asset.boundingBox
    val center = box.center
    val half = box.halfExtent
    val extent = max(half[0], max(half[1], half[2])) * 2f
    if (extent <= 0f) return Position(0f, 0f, 0f)
    val scale = size / extent
    return Position(
      -center[0] * scale,
      (half[1] - center[1]) * scale,
      -center[2] * scale
    )
  }
}
