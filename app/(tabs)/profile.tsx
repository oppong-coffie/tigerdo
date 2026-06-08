import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaGuard } from "@/components/ui/safe-area-guard";

export default function Profile() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("Guard");
  const [totalLogs, setTotalLogs] = useState(0);
  const [activeShiftLogs, setActiveShiftLogs] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubLogs: (() => void) | null = null;

    const fetchUserData = async () => {
      try {
        // Check guards collection first
        let docRef = doc(db, "guards", user.uid);
        let docSnap = await getDoc(docRef);
        let userRole = "Guard";

        if (!docSnap.exists()) {
          // Check supervisors collection
          docRef = doc(db, "supervisors", user.uid);
          docSnap = await getDoc(docRef);
          userRole = "Supervisor";
        }

        if (docSnap.exists() && isMounted) {
          setUserData(docSnap.data());
          setRole(userRole);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserData();

    // Set up realtime listener for logs to count them and get active status
    try {
      const q = query(collection(db, "logs"), where("uid", "==", user.uid));
      unsubLogs = onSnapshot(q, (snapshot) => {
        if (!isMounted) return;

        const logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as any[];

        // Sort by createdAt descending
        logs.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });

        // Set total logs count
        setTotalLogs(logs.length);

        // Determine if shift is active and count current shift logs
        let active = false;
        let shiftLogsCount = 0;

        if (logs.length > 0) {
          const latestLog = logs[0];
          active = latestLog.activity !== "Duty off";

          if (active && latestLog.shiftId) {
            const currentShiftId = latestLog.shiftId;
            shiftLogsCount = logs.filter((log) => log.shiftId === currentShiftId).length;
          }
        }

        setIsActive(active);
        setActiveShiftLogs(shiftLogsCount);
      }, (error) => {
        console.error("Error listening to logs:", error);
      });
    } catch (error) {
      console.error("Error setting up logs listener:", error);
    }

    return () => {
      isMounted = false;
      if (unsubLogs) unsubLogs();
    };
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

  const openPostLocation = () => {
    if (userData?.latitude && userData?.longitude) {
      const lat = userData.latitude;
      const lng = userData.longitude;
      const label = encodeURIComponent(`${userData.name || "Officer"}'s Station`);
      const url = Platform.select({
        ios: `maps:0,0?q=${lat},${lng}(${label})`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
        default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      });
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open map URL:", err);
        Alert.alert("Error", "Could not open map coordinates.");
      });
    } else {
      Alert.alert("No Location Assigned", "This profile does not have post coordinates assigned.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: "#08080A", justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#FF453A" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#08080A", "#140A0D", "#1D0A0E"]}
      style={styles.container}
    >
      <SafeAreaGuard style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER SECTION */}
          <View style={styles.headerSection}>
            <View style={styles.avatarWrapper}>
              <Image
                source={require("../../assets/images/avatar.png")}
                style={styles.avatar}
              />
              <View style={[
                styles.statusDot,
                { backgroundColor: isActive ? "#30D158" : "#FF9F0A" }
              ]} />
            </View>
            <Text style={styles.name}>{userData?.name || "Officer Name"}</Text>
            <Text style={styles.badgeId}>ID: {userData?.code || userData?.supervisorID || "N/A"}</Text>
            
            <View style={styles.roleBadge}>
              <LinearGradient
                colors={role === "Supervisor" ? ["#3182CE", "#2B6CB0"] : ["#E53E3E", "#9B2C2C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.roleBadgeGradient}
              >
                <Ionicons 
                  name={role === "Supervisor" ? "shield-checkmark-outline" : "shield-outline"} 
                  size={14} 
                  color="#FFF" 
                  style={{ marginRight: 5 }} 
                />
                <Text style={styles.roleText}>
                  {role === "Supervisor" ? "SUPERVISOR" : "SECURITY GUARD"}
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* ACTIVE SHIFT SUMMARY */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={isActive ? "pulse-outline" : "moon-outline"} 
                size={22} 
                color={isActive ? "#30D158" : "#FF9F0A"} 
              />
              <Text style={styles.statusTitle}>Duty Status</Text>
            </View>
            <View style={styles.statusBody}>
              <Text style={styles.statusLabelText}>Current State:</Text>
              <View style={[
                styles.stateBadge, 
                { backgroundColor: isActive ? "rgba(48, 209, 88, 0.15)" : "rgba(255, 159, 10, 0.15)" }
              ]}>
                <Text style={[
                  styles.stateText,
                  { color: isActive ? "#30D158" : "#FF9F0A" }
                ]}>
                  {isActive ? "ACTIVE SHIFT" : "OFF DUTY"}
                </Text>
              </View>
            </View>
          </View>

          {/* METRICS GRID */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="clipboard-outline" size={20} color="#FF453A" />
              </View>
              <Text style={styles.statValue}>{isActive ? activeShiftLogs : 0}</Text>
              <Text style={styles.statLabelText}>Shift Entries</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="layers-outline" size={20} color="#FF453A" />
              </View>
              <Text style={styles.statValue}>{totalLogs}</Text>
              <Text style={styles.statLabelText}>Total Lifetime Logs</Text>
            </View>
          </View>

          {/* PROFILE DETAILS SECTION */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeaderTitle}>OFFICER PROFILE DATA</Text>
            
            {/* Email */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="mail-outline" size={20} color="#9E9EAF" />
                <Text style={styles.detailLabel}>Email</Text>
              </View>
              <Text style={styles.detailValue} numberOfLines={1}>
                {userData?.email || auth.currentUser?.email || "N/A"}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Phone */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="call-outline" size={20} color="#9E9EAF" />
                <Text style={styles.detailLabel}>Phone</Text>
              </View>
              <Text style={styles.detailValue}>
                {userData?.phone || "Not Set"}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Post Location */}
            <TouchableOpacity 
              style={styles.detailRow} 
              onPress={openPostLocation}
              activeOpacity={0.7}
            >
              <View style={styles.detailLeft}>
                <Ionicons name="location-outline" size={20} color="#9E9EAF" />
                <Text style={styles.detailLabel}>Assigned Post</Text>
              </View>
              {userData?.latitude && userData?.longitude ? (
                <View style={styles.locationLink}>
                  <Text style={styles.detailValueLink}>
                    {parseFloat(userData.latitude).toFixed(4)}, {parseFloat(userData.longitude).toFixed(4)}
                  </Text>
                  <Ionicons name="open-outline" size={14} color="#FF453A" style={{ marginLeft: 4 }} />
                </View>
              ) : (
                <Text style={styles.detailValue}>No Post Assigned</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* QUICK LINKS SECTION */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardHeaderTitle}>PRESTIGE PORTAL ACTIONS</Text>

            {/* Link to Shift History */}
            <TouchableOpacity 
              style={styles.actionRow}
              onPress={() => router.push("/(tabs)/history")}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrapper, { backgroundColor: "rgba(255, 159, 10, 0.1)" }]}>
                  <Ionicons name="time-outline" size={18} color="#FF9F0A" />
                </View>
                <Text style={styles.actionLabel}>View Shift Logs</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#9E9EAF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Link to Authorize List */}
            <TouchableOpacity 
              style={styles.actionRow}
              onPress={() => router.push("/(tabs)/authorize")}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrapper, { backgroundColor: "rgba(48, 209, 88, 0.1)" }]}>
                  <Ionicons name="checkmark-shield-outline" size={18} color="#30D158" />
                </View>
                <Text style={styles.actionLabel}>Authorized Guests & Cars</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#9E9EAF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Link to Emergency */}
            <TouchableOpacity 
              style={styles.actionRow}
              onPress={() => router.push("/(tabs)/emergency")}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrapper, { backgroundColor: "rgba(255, 69, 58, 0.1)" }]}>
                  <Ionicons name="people-outline" size={18} color="#FF453A" />
                </View>
                <Text style={styles.actionLabel}>Emergency Contacts</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color="#9E9EAF" />
            </TouchableOpacity>
          </View>

          {/* LOGOUT BUTTON */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutBtnText}>END SESSION & LOGOUT</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaGuard>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  // Header Section
  headerSection: {
    alignItems: "center",
    marginVertical: 20,
    width: "100%",
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.5,
    borderColor: "#FF453A",
    backgroundColor: "#1A1A1E",
  },
  statusDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#08080A",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  badgeId: {
    fontSize: 14,
    color: "#9E9EAF",
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: "600",
  },
  roleBadge: {
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  roleBadgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  roleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  // Status Card
  statusCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  statusBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stateBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  stateText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 69, 58, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  statLabelText: {
    fontSize: 12,
    color: "#9E9EAF",
    fontWeight: "500",
  },
  // Details Card
  detailsCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF453A",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#9E9EAF",
    marginLeft: 10,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    maxWidth: "60%",
  },
  locationLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailValueLink: {
    fontSize: 14,
    color: "#FF453A",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    width: "100%",
  },
  // Action rows
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  // Logout Button
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF453A",
    width: "100%",
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: "#FF453A",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
});
