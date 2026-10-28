import { Platform, requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType, Ref } from "react";
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";

/**
 * - `supported`: ready to use
 * - `needsInstall`: supported, but ARCore will prompt to be installed or updated
 * - `unsupported`: the phone can't do AR
 * - `unknown`: couldn't tell, e.g. offline on first check, or not Android
 */
export type ArAvailability = "supported" | "needsInstall" | "unsupported" | "unknown";

/**
 * - `searching`: tracking, but no surface found yet
 * - `ready`: a surface is found and a tap places the model
 * - `limited`: tracking is lost; `reason` says why (e.g. `insufficient_light`)
 */
export type ArTrackingEvent = {
  state: "searching" | "ready" | "limited";
  reason?: string | null;
};

export type ArPlacementViewProps = {
  /** Local `file://` path of a .glb, e.g. from `Asset.downloadAsync()` */
  modelUri: string | null;
  /** Largest side of the model in the room, in meters */
  modelSize?: number;
  /** Show the dots on detected surfaces */
  showPlanes?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ArPlacementViewRef>;
  onTrackingChange?: (event: NativeSyntheticEvent<ArTrackingEvent>) => void;
  onModelLoad?: () => void;
  onPlaced?: () => void;
  onError?: (event: NativeSyntheticEvent<{ message: string }>) => void;
};

export type ArPlacementViewRef = {
  /** Remove the placed model so the next tap places it again */
  reset: () => Promise<void>;
};

const ArPlacementModule = requireOptionalNativeModule<{
  getAvailabilityAsync(): Promise<ArAvailability>;
}>("ArPlacement");

export async function getAvailabilityAsync(): Promise<ArAvailability> {
  return (await ArPlacementModule?.getAvailabilityAsync()) ?? "unknown";
}

const NativeView: ComponentType<ArPlacementViewProps> | null =
  Platform.OS === "android" ? requireNativeView("ArPlacement") : null;

/** Camera view that places a model on a tapped surface. Android only; renders nothing elsewhere */
export function ArPlacementView(props: ArPlacementViewProps) {
  return NativeView ? <NativeView {...props} /> : null;
}
