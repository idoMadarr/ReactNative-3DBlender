import { useGLTF } from "@react-three/drei/native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import {
  Box3,
  Sphere,
  Vector3,
  type Group,
  type PerspectiveCamera,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type ModelViewerProps = {
  /** Bundled model file, e.g. `require("./robot.glb")` */
  source: number;
  /** Size and place the viewer like any View; the model fits inside it */
  style?: StyleProp<ViewStyle>;
  /** Share of the view the model spans, from 0 to 1 */
  fill?: number;
  autoRotate?: boolean;
  /** Radians per second */
  autoRotateSpeed?: number;
  /** Rotate the model by dragging */
  draggable?: boolean;
  backgroundColor?: string;
};

// Camera looks at the model from the front-right, slightly above
const VIEW_DIRECTION = new Vector3(2, 1.5, 2.2).normalize();
const FOV = 30;
// Radians of rotation per pixel dragged
const DRAG_SPEED = 0.01;
const MAX_TILT = Math.PI / 2;
const INTRO_SECONDS = 0.7;
const INTRO_TWIST = Math.PI / 2;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

function Model({
  source,
  spinRef,
  spinSpeed,
}: {
  source: number;
  spinRef: RefObject<Group | null>;
  spinSpeed: number;
}) {
  const { scene } = useGLTF(
    // fiber/native resolves bundled asset IDs, but drei only types string paths
    source as unknown as string,
  );
  // Copy the model so the same file can be shown in several viewers, and
  // normalize it to a unit sphere at the origin so framing never depends on
  // how big it was exported
  const { object, offset, scale } = useMemo(() => {
    const object = clone(scene);
    const { center, radius } = new Box3()
      .setFromObject(object)
      .getBoundingSphere(new Sphere());
    return {
      object,
      offset: center.negate(),
      scale: radius > 0 ? 1 / radius : 1,
    };
  }, [scene]);

  // Each new model pops in: grows with a slight overshoot while unwinding
  // a quarter turn
  const introRef = useRef<Group>(null);
  const introProgress = useRef(0);
  useLayoutEffect(() => {
    introProgress.current = 0;
    introRef.current?.scale.setScalar(0);
  }, [object]);

  useFrame((_, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * spinSpeed;
    const intro = introRef.current;
    if (intro && introProgress.current < 1) {
      const t = Math.min(1, introProgress.current + delta / INTRO_SECONDS);
      introProgress.current = t;
      intro.scale.setScalar(easeOutBack(t));
      intro.rotation.y = (1 - easeOutCubic(t)) * -INTRO_TWIST;
    }
  });

  return (
    <group ref={spinRef}>
      <group ref={introRef} scale={0}>
        <group scale={scale}>
          <group position={offset}>
            <primitive object={object} />
          </group>
        </group>
      </group>
    </group>
  );
}

// Places the camera so the unit sphere spans `fill` of the view's narrower
// side. The sphere bounds the model at every rotation, so it never clips
function FitCamera({ fill }: { fill: number }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const aspect = useThree((state) => state.size.width / state.size.height);
  useLayoutEffect(() => {
    const tanHalfV = Math.tan((camera.fov * Math.PI) / 360);
    const tanHalf = tanHalfV * Math.min(1, aspect);
    const distance = 1 / Math.sin(Math.atan(fill * tanHalf));
    camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
  }, [camera, aspect, fill]);
  return null;
}

export function ModelViewer({
  source,
  style,
  fill = 0.9,
  autoRotate = true,
  autoRotateSpeed = 0.5,
  draggable = true,
  backgroundColor = "#f3f3f3",
}: ModelViewerProps) {
  const spinRef = useRef<Group>(null);

  const pan = usePanGesture({
    enabled: draggable,
    // three.js objects live on the JS thread, so handle the gesture there
    runOnJS: true,
    onUpdate: (e) => {
      const model = spinRef.current;
      if (!model) return;
      model.rotation.y += e.changeX * DRAG_SPEED;
      model.rotation.x = Math.min(
        MAX_TILT,
        Math.max(-MAX_TILT, model.rotation.x + e.changeY * DRAG_SPEED),
      );
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Canvas camera={{ fov: FOV }}>
        <color attach="background" args={[backgroundColor]} />
        <FitCamera fill={fill} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={2} />
        <Suspense fallback={null}>
          <Model
            source={source}
            spinRef={spinRef}
            spinSpeed={autoRotate ? autoRotateSpeed : 0}
          />
        </Suspense>
      </Canvas>
      {/* Overlay so the Canvas's own touch responder can't cancel the pan */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
});
