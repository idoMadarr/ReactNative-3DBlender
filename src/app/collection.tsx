import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAvailabilityAsync } from "../../modules/ar-placement";
import { ModelViewer } from "../components/model-viewer";
import { MODELS, type ModelEntry } from "../constants/models";

const CARD_WIDTH = 132;
const CARD_GAP = 12;
const SIDE_PADDING = 24;

const LIGHT = {
  background: "#F4F3EF",
  surface: "#FFFFFF",
  stage: "#EAE8E2",
  text: "#121212",
  muted: "#8C8A84",
  selected: "#121212",
  selectedText: "#FFFFFF",
};

const DARK: typeof LIGHT = {
  background: "#0E0E0E",
  surface: "#1A1A1A",
  stage: "#161616",
  text: "#F2F2F2",
  muted: "#7A7A7A",
  selected: "#F2F2F2",
  selectedText: "#121212",
};

type Theme = typeof LIGHT;

const pad = (n: number) => String(n).padStart(2, "0");

export default function CollectionScreen() {
  const theme = useColorScheme() === "dark" ? DARK : LIGHT;
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const stripRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const canPlaceInAr = useArSupport();

  const model = MODELS[index];

  // Keep the selected card centered in the strip
  useEffect(() => {
    stripRef.current?.scrollTo({
      x: Math.max(0, index * (CARD_WIDTH + CARD_GAP) - CARD_WIDTH / 2),
      animated: true,
    });
  }, [index]);

  if (!model) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No models yet
        </Text>
        <Text style={[styles.muted, { color: theme.muted }]}>
          Add .glb files to src/blender_repo
        </Text>
      </View>
    );
  }

  const go = (step: number) =>
    setIndex((i) => (i + step + MODELS.length) % MODELS.length);

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>
            COLLECTION
          </Text>
          <Text style={[styles.counter, { color: theme.muted }]}>
            {pad(index + 1)} / {pad(MODELS.length)}
          </Text>
        </View>
        {/* Old and new titles overlap while one slides out and the other in */}
        <View style={styles.titleSlot}>
          <Animated.Text
            key={model.id}
            entering={FadeInDown.duration(350)}
            exiting={FadeOutUp.duration(250)}
            numberOfLines={1}
            style={[styles.title, { color: theme.text }]}
          >
            {model.name}
          </Animated.Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(150).duration(600)}
        style={[styles.stage, { backgroundColor: theme.stage }]}
      >
        <ModelViewer
          source={model.source}
          style={StyleSheet.absoluteFill}
          backgroundColor={theme.stage}
          fill={0.8}
        />
        <Text
          pointerEvents="none"
          style={[styles.hint, { color: theme.muted }]}
        >
          Drag to rotate
        </Text>
        {canPlaceInAr && (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/ar/[id]", params: { id: model.id } })
            }
            hitSlop={8}
            style={[styles.arButton, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.arButtonLabel, { color: theme.text }]}>
              Place in AR
            </Text>
          </Pressable>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(250).duration(500)}
        style={styles.controls}
      >
        <RoundButton label="‹" theme={theme} onPress={() => go(-1)} />
        <View style={styles.dots}>
          {MODELS.map((m, i) => (
            <Dot key={m.id} active={i === index} theme={theme} />
          ))}
        </View>
        <RoundButton label="›" theme={theme} onPress={() => go(1)} />
      </Animated.View>

      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripScroll}
      >
        {MODELS.map((m, i) => (
          <Animated.View
            key={m.id}
            entering={FadeInRight.delay(300 + i * 70).springify()}
          >
            <ModelCard
              model={m}
              number={i + 1}
              selected={i === index}
              theme={theme}
              onPress={() => setIndex(i)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Whether this phone can place models in AR; ARCore is Android only */
function useArSupport() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    getAvailabilityAsync().then((availability) =>
      setSupported(
        availability === "supported" || availability === "needsInstall",
      ),
    );
  }, []);
  return supported;
}

function ModelCard({
  model,
  number,
  selected,
  theme,
  onPress,
}: {
  model: ModelEntry;
  number: number;
  selected: boolean;
  theme: Theme;
  onPress: () => void;
}) {
  const active = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(1);

  useEffect(() => {
    active.set(withTiming(selected ? 1 : 0, { duration: 280 }));
  }, [selected, active]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      active.value,
      [0, 1],
      [theme.surface, theme.selected],
    ),
    transform: [
      { scale: pressed.value },
      { translateY: -6 * active.value },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      active.value,
      [0, 1],
      [theme.text, theme.selectedText],
    ),
  }));
  const numberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      active.value,
      [0, 1],
      [theme.muted, theme.selectedText],
    ),
    opacity: 0.6 + 0.4 * active.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressed.set(withSpring(0.94))}
      onPressOut={() => pressed.set(withSpring(1))}
    >
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.Text style={[styles.cardNumber, numberStyle]}>
          {pad(number)}
        </Animated.Text>
        <Animated.Text numberOfLines={2} style={[styles.cardName, textStyle]}>
          {model.name}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function Dot({ active, theme }: { active: boolean; theme: Theme }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 22 : 6),
    opacity: withTiming(active ? 1 : 0.3),
  }));
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: theme.text }, style]}
    />
  );
}

function RoundButton({
  label,
  theme,
  onPress,
}: {
  label: string;
  theme: Theme;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => scale.set(withSpring(0.88))}
      onPressOut={() => scale.set(withSpring(1))}
      hitSlop={8}
    >
      <Animated.View
        style={[styles.roundButton, { backgroundColor: theme.surface }, style]}
      >
        <Text style={[styles.roundButtonLabel, { color: theme.text }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: SIDE_PADDING, marginBottom: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: { fontSize: 12, fontWeight: "600", letterSpacing: 2 },
  counter: { fontSize: 13, fontWeight: "500", fontVariant: ["tabular-nums"] },
  titleSlot: { height: 44, marginTop: 6, overflow: "hidden" },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  stage: {
    flex: 1,
    marginHorizontal: SIDE_PADDING,
    borderRadius: 32,
    overflow: "hidden",
  },
  hint: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  arButton: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  arButtonLabel: { fontSize: 13, fontWeight: "600" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIDE_PADDING,
    marginTop: 20,
  },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonLabel: { fontSize: 26, lineHeight: 30, fontWeight: "300" },
  stripScroll: { flexGrow: 0, marginTop: 20 },
  strip: {
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 8,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: 112,
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
  },
  cardNumber: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  cardName: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  muted: { fontSize: 14 },
});
