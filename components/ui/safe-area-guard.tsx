import React from "react";
import { StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

interface SafeAreaGuardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function SafeAreaGuard({
  children,
  style,
  edges = ["top", "left", "right"],
}: SafeAreaGuardProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
