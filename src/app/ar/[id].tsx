import { Asset } from "expo-asset";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ArPlacementView,
  type ArPlacementViewRef,
  type ArTrackingEvent,
} from "../../../modules/ar-placement";
import { MODELS } from "../../constants/models";

const LIMITED_HINTS: Record<string, string> = {
  insufficient_light: "Too dark — find more light",
  excessive_motion: "Moving too fast — slow down",
  insufficient_features: "Point at a surface with more texture",
};

type Permission = "pending" | "granted" | "denied";

export default function PlaceInArScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = MODELS.find((m) => m.id === id);
  const insets = useSafeAreaInsets();
  const arRef = useRef<ArPlacementViewRef>(null);

  const [permission, setPermission] = useState<Permission>("pending");
  const [modelUri, setModelUri] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tracking, setTracking] = useState<ArTrackingEvent | null>(null);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).then(
      (result) =>
        setPermission(
          result === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied",
        ),
    );
  }, []);

  // The native view reads a real file; in development the bundled asset is
  // downloaded from the dev server first
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    Asset.fromModule(model.source)
      .downloadAsync()
      .then((asset) => !cancelled && setModelUri(asset.localUri))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [model]);

  if (!model) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.message}>Model not found</Text>
        <CloseButton top={insets.top + 12} />
      </View>
    );
  }

  const reset = () => {
    arRef.current?.reset();
    setPlaced(false);
  };

  let hint: string;
  if (error) hint = error;
  else if (!loaded) hint = "Loading model…";
  else if (!tracking || tracking.state === "searching")
    hint = "Move your phone slowly to find the floor";
  else if (tracking.state === "limited")
    hint = LIMITED_HINTS[tracking.reason ?? ""] ?? "Hold steady…";
  else if (!placed) hint = "Aim the ring and tap to place";
  else hint = "Pinch to resize · Twist to rotate · Tap elsewhere to move";

  return (
    <View style={styles.screen}>
      {permission === "granted" && (
        <ArPlacementView
          ref={arRef}
          modelUri={modelUri}
          modelSize={model.arSize}
          style={StyleSheet.absoluteFill}
          onModelLoad={() => setLoaded(true)}
          onTrackingChange={(e) => setTracking(e.nativeEvent)}
          onPlaced={() => setPlaced(true)}
          onError={(e) => setError(e.nativeEvent.message)}
        />
      )}

      {permission === "denied" && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.message}>
            Camera access is needed to place models in your room
          </Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>Open settings</Text>
            </View>
          </Pressable>
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text numberOfLines={1} style={styles.title}>
          {model.name}
        </Text>
      </View>
      <CloseButton top={insets.top + 12} />

      {permission === "granted" && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <Animated.Text
            key={hint}
            entering={FadeIn.duration(250)}
            style={styles.hint}
          >
            {hint}
          </Animated.Text>
          {placed && (
            <Animated.View entering={FadeIn.duration(250)}>
              <Pressable onPress={reset}>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Reset</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

function CloseButton({ top }: { top: number }) {
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      style={[styles.close, { top }]}
    >
      <Text style={styles.closeLabel}>✕</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  message: { color: "#F2F2F2", fontSize: 16, textAlign: "center" },
  header: {
    position: "absolute",
    left: 72,
    right: 72,
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 40,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 6,
  },
  close: {
    position: "absolute",
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeLabel: { color: "#FFFFFF", fontSize: 16 },
  footer: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 0,
    alignItems: "center",
    gap: 14,
  },
  hint: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
  pill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  pillLabel: { color: "#121212", fontSize: 15, fontWeight: "600" },
});
