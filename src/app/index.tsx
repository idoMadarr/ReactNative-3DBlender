import { Center, useGLTF } from "@react-three/drei/native";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { Suspense, useLayoutEffect, useRef, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import type { Group } from "three";

import tableModel from "../blender_repo/app_logo.glb";

let n = 0;
setInterval(() => console.log("DEBUG frames so far", n), 3000);
function Probe() {
  useFrame(() => {
    n++;
  });
  return null;
}

function CameraSetup() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(2, 1.5, 2.2);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// Radians of rotation per pixel dragged
const ROTATE_SPEED = 0.01;
const MAX_TILT = Math.PI / 2;

function Table({ groupRef }: { groupRef: RefObject<Group | null> }) {
  const { scene } = useGLTF(
    // fiber/native resolves bundled asset IDs, but drei only types string paths
    tableModel as unknown as string,
  );
  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

export default function HomeScreen() {
  const tableRef = useRef<Group>(null);

  const pan = usePanGesture({
    // three.js objects live on the JS thread, so handle the gesture there
    runOnJS: true,
    onUpdate: (e) => {
      const table = tableRef.current;
      if (!table) return;
      table.rotation.y += e.changeX * ROTATE_SPEED;
      table.rotation.x = Math.min(
        MAX_TILT,
        Math.max(-MAX_TILT, table.rotation.x + e.changeY * ROTATE_SPEED),
      );
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Canvas>
        <color attach='background' args={["#3366ff"]} />
        <CameraSetup />
        <Probe />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={2} />
        <Suspense fallback={null}>
          <Table groupRef={tableRef} />
        </Suspense>
      </Canvas>
      {/* Overlay so the Canvas's own touch responder can't cancel the pan */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}
