import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function Profile() {
  return (
    <LinearGradient
      colors={["#000000", "#1A0000", "#300000"]}
      style={styles.container}
    >
      <View style={styles.card}>
        <Image
          source={require("../../assets/images/avatar.png")}
          style={styles.avatar}
        />

        <Text style={styles.title}>Nana Akua</Text>
        <Text style={styles.code}>G-404</Text>

        <View style={styles.infoBox}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>0551144173</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.label}>Joined:</Text>
          <Text style={styles.value}>23 / 12 / 2025</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  card: {
    width: "92%",
    padding: 28,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.4)",

    // Soft red glow
    shadowColor: "#ff0000",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
  },

  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginBottom: 18,
    borderWidth: 3,
    borderColor: "#ff2a2a",
  },

  title: {
    fontSize: 30,
    color: "#ffffff",
    fontWeight: "700",
  },

  code: {
    fontSize: 20,
    color: "#ff4d4d",
    fontWeight: "500",
    marginBottom: 20,
  },

  infoBox: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  label: {
    color: "#bbbbbb",
    fontSize: 16,
  },

  value: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
