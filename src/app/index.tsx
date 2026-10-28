import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import robotModel from "../blender_repo/robot_bluewhite.glb";
import { ModelViewer } from "../components/model-viewer";

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <ModelViewer source={robotModel} style={styles.viewer} />
      <Link href="/collection" style={styles.link}>
        <Text>Open collection →</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f3f3",
  },
  link: { marginTop: 24, fontSize: 16, fontWeight: "600" },
  viewer: { width: 200, height: 200, backgroundColor: "red" },
});
