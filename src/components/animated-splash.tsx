import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
} from "react-native-reanimated";

// Keep the native splash up until this overlay has drawn on top of it
SplashScreen.preventAutoHideAsync();

// Must match the expo-splash-screen plugin settings in app.json, so the
// handoff from the native splash is seamless
const BACKGROUND = "#208AEF";
const ICON_SIZE = 76;
const HOLD_MS = 1600;

export function AnimatedSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(400)}
      style={styles.overlay}
      onLayout={() => SplashScreen.hideAsync()}
    >
      <Image
        source={require("../../assets/images/splash-icon.png")}
        style={styles.icon}
        contentFit="contain"
      />
      {/* Positioned below center so the icon stays exactly where the native
          splash drew it */}
      <View style={styles.titleSlot} pointerEvents="none">
        <Animated.Text
          entering={FadeInDown.delay(150).duration(600)}
          style={styles.title}
        >
          Hunyuan 3D
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  icon: { width: ICON_SIZE, height: ICON_SIZE },
  titleSlot: {
    position: "absolute",
    top: "50%",
    marginTop: ICON_SIZE / 2 + 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
