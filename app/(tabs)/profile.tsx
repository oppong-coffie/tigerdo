import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect } from "react";
import { Image, StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { auth, db } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Profile() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Check guards collection first
          let docRef = doc(db, "guards", user.uid);
          let docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            // Check supervisors collection
            docRef = doc(db, "supervisors", user.uid);
            docSnap = await getDoc(docRef);
          }

          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/");
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "Failed to log out.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <ActivityIndicator size="large" color="#ff2a2a" />
      </View>
    );
  }

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

        <Text style={styles.title}>{userData?.name || "User"}</Text>
        <Text style={styles.code}>{userData?.code || userData?.supervisorID || "N/A"}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{userData?.email || auth.currentUser?.email}</Text>
        </View>

        {userData?.phone && (
          <View style={styles.infoBox}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{userData.phone}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff2a2a",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 30,
    shadowColor: "#ff2a2a",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  logoutText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
});
