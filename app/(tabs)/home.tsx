import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";

import * as Notifications from "expo-notifications";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import React, { Component } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

const PETROL_REMINDER_INTERVAL_SECONDS = 1800; // 30 minutes (1800 seconds)
const MAX_SHIFT_HOURS = 12; // Maximum shift duration to schedule notifications for
// ================================================

// REMOVED STATIC DATA: OCCURRENCES

export class Index extends Component {
  state = {
    isActive: false,
    logs: [] as any[],
    loading: true,
    inputText: "",
    currentDayNumber: 0,
    currentShiftId: "",
    currentShiftStart: null as Date | null,
    guardName: "Loading...",
    guardCode: "...",
    targetLat: null as number | null,
    targetLng: null as number | null,
    startingShift: false,
  };

  unsubscribe: any = null;
  petrolReminderNotificationId: string | null = null;
  petrolReminderInterval: ReturnType<typeof setInterval> | null = null; // Timer for foreground notifications
  reminderSound: any = null;
  notificationListener: any = null;
  responseListener: any = null;

  async componentDidMount() {
    await this.registerForPushNotificationsAsync();

    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "guards", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.setState({
          guardName: data.name || "Unknown Guard",
          guardCode: data.code || "N/A",
          targetLat: data.latitude ? parseFloat(data.latitude) : null,
          targetLng: data.longitude ? parseFloat(data.longitude) : null,
        });
      } else {
        const supRef = doc(db, "supervisors", user.uid);
        const supSnap = await getDoc(supRef);
        if (supSnap.exists()) {
          const data = supSnap.data();
          this.setState({
            guardName: data.name || "Supervisor",
            guardCode: "SUP",
            targetLat: data.latitude ? parseFloat(data.latitude) : null,
            targetLng: data.longitude ? parseFloat(data.longitude) : null,
          });
        }
      }
    }

    // Handle notifications when app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        // Play sound when notification is received in foreground
        this.playReminderSound();
      },
    );

    // Handle notification response (when user taps the notification)
    this.responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);
      });

    if (user) {
      // Subscribe to logs collection
      const q = query(
        collection(db, "logs"),
        where("uid", "==", user.uid)
      );
      this.unsubscribe = onSnapshot(q, (snapshot) => {
        let logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by createdAt descending and limit to 50
        logs.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
          return timeB - timeA;
        });
        logs = logs.slice(0, 50);

        // Calculate the day of the year (1-365/366)
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const diff = now.getTime() - startOfYear.getTime();
        const oneDay = 1000 * 60 * 60 * 24;
        const currentDayNumber = Math.floor(diff / oneDay);

        // Determine state from latest log
        let isActive = false;
        let currentShiftId = "";
        let currentShiftStart: Date | null = null;

        if (logs.length > 0) {
          const latestLog: any = logs[0];

          // If the latest log is NOT "Duty off", we are active.
          isActive = latestLog.activity !== "Duty off";

          // Get the current shift ID from the latest log if active
          if (isActive && latestLog.shiftId) {
            currentShiftId = latestLog.shiftId;
            // Find the shift start time from the "Duty on" log
            const dutyOnLog: any = logs.find(
              (log: any) =>
                log.shiftId === currentShiftId && log.activity === "Duty on",
            );
            if (dutyOnLog && dutyOnLog.createdAt && dutyOnLog.createdAt.toDate) {
              currentShiftStart = dutyOnLog.createdAt.toDate();
            }
          }
        }

        this.setState({
          logs,
          loading: false,
          currentDayNumber,
          isActive,
          currentShiftId,
          currentShiftStart,
        });
      });
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.stopPetrolReminder();
    // Unload sound if loaded
    if (this.reminderSound) {
      this.reminderSound.unloadAsync();
    }
    // Remove notification listeners using the new .remove() method
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }

  // Register for push notifications and get permission
  registerForPushNotificationsAsync = async () => {
    try {
      // Request notification permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notification Permission Required",
          "Please enable notifications to receive petrol reminders even when the app is closed.",
        );
        return;
      }

      // Configure Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("petrol-reminder", {
          name: "Petrol Reminders",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#3182CE",
          sound: "default",
          enableVibrate: true,
          showBadge: true,
        });
      }
    } catch (error) {
      console.error("Error registering for notifications:", error);
    }
  };

  // ============ PETROL REMINDER METHODS ============
  startPetrolReminder = async () => {
    // Clear any existing reminders first
    await this.stopPetrolReminder();

    const intervalSeconds = PETROL_REMINDER_INTERVAL_SECONDS;
    const intervalMs = intervalSeconds * 1000;

    // Calculate how many notifications to schedule for the entire shift
    const notificationsCount = Math.floor(
      (MAX_SHIFT_HOURS * 3600) / intervalSeconds,
    );

    console.log(
      `[${new Date().toLocaleTimeString()}] Scheduling ${notificationsCount} notifications (every ${
        intervalSeconds / 60
      } minutes for ${MAX_SHIFT_HOURS} hours)`,
    );

    // Schedule all future notifications (works even when app is closed)
    for (let i = 1; i <= notificationsCount; i++) {
      const triggerSeconds = i * intervalSeconds;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⛽ Petrol Reminder",
            body: "Time to conduct petrol around the house.",
            sound: "default",
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { type: "petrol-reminder", index: i },
            ...(Platform.OS === "android" && { channelId: "petrol-reminder" }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: triggerSeconds,
            repeats: false, // One-time notification
          },
        });
      } catch (error) {
        console.error(`Error scheduling notification ${i}:`, error);
      }
    }

    console.log(
      `[${new Date().toLocaleTimeString()}] Successfully scheduled ${notificationsCount} background notifications`,
    );

    // Also keep foreground timer as backup (for immediate feedback when app is open)
    this.petrolReminderInterval = setInterval(() => {
      console.log(`[${new Date().toLocaleTimeString()}] Foreground timer tick`);
    }, intervalMs);
  };

  sendPetrolNotification = async () => {
    try {
      console.log(
        `[${new Date().toLocaleTimeString()}] Sending petrol reminder...`,
      );
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⛽ Petrol Reminder",
          body: `Time to conduct petrol around the house. (${new Date().toLocaleTimeString()})`,
          sound: "default",
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { type: "petrol-reminder" },
          ...(Platform.OS === "android" && { channelId: "petrol-reminder" }),
        },
        trigger: null, // null = immediate notification
      });
      console.log(
        `[${new Date().toLocaleTimeString()}] Petrol reminder notification sent!`,
      );
    } catch (error) {
      console.error(
        `[${new Date().toLocaleTimeString()}] Error sending petrol reminder:`,
        error,
      );
    }
  };

  stopPetrolReminder = async () => {
    // Clear the interval timer
    if (this.petrolReminderInterval) {
      clearInterval(this.petrolReminderInterval);
      this.petrolReminderInterval = null;
      console.log("Petrol reminder timer cleared");
    }

    // Cancel ALL scheduled notifications when shift ends
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("All scheduled notifications cancelled - shift ended");
    } catch (error) {
      console.error("Error cancelling notifications:", error);
    }
  };

  playReminderSound = async () => {
    try {
      // Configure audio mode for playing sounds
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Use a built-in system sound or load a custom sound
      // For simplicity, we'll create a beep-like sound using Audio API
      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://www.soundjay.com/buttons/beep-07a.mp3" },
        { shouldPlay: true, volume: 1.0 },
      );
      this.reminderSound = sound;

      // Unload sound after playing to free resources
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error("Error playing reminder sound:", error);
      // Fallback: use haptic feedback if sound fails
      try {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // Haptics not available, ignore
      }
    }
  };
  // ================================================

  toggleStatus = async () => {
    const { isActive, currentDayNumber, currentShiftId, targetLat, targetLng } =
      this.state;
    const newStatus = !isActive;

    if (newStatus) {
      // STARTING SHIFT - Check location
      if (
        targetLat !== null &&
        !isNaN(targetLat) &&
        targetLng !== null &&
        !isNaN(targetLng)
      ) {
        this.setState({ startingShift: true });

        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permission Required",
              "Permission to access location was denied. Cannot start shift.",
            );
            this.setState({ startingShift: false });
            return;
          }

          let location = await Location.getCurrentPositionAsync({});
          const currentLat = location.coords.latitude;
          const currentLng = location.coords.longitude;

          const distanceKm = this.getDistanceFromLatLonInKm(
            currentLat,
            currentLng,
            targetLat,
            targetLng,
          );

          if (distanceKm > 0.1) {
            // 100 meters
            Alert.alert(
              "Location Error",
              `You are too far from your assigned post to start the shift. (${(distanceKm * 1000).toFixed(0)} meters away)`,
            );
            this.setState({ startingShift: false });
            return;
          }
        } catch (err) {
          Alert.alert(
            "Location Error",
            "Could not fetch your current location. Please try again.",
          );
          this.setState({ startingShift: false });
          return;
        }
      }

      this.setState({ isActive: newStatus, startingShift: false });

      // STARTing a new shift - create a unique shift ID
      const newShiftId = `shift_${Date.now()}`;
      const shiftStartTime = new Date();
      await this.addLog(
        "Duty on",
        "shield-checkmark-outline",
        currentDayNumber,
        newShiftId,
        shiftStartTime,
      );
      // Update state with new shift info
      this.setState({
        currentShiftId: newShiftId,
        currentShiftStart: shiftStartTime,
      });

      // Start the petrol reminder (alerts every 60 minutes - works even when app is closed)
      await this.startPetrolReminder();

      // Show initial notification that petrol reminders are enabled
      Alert.alert(
        "Shift Started",
        "You'll be reminded to check petrol every 30 minutes.\n\n✅ Notifications will work even if you close the app!",
        [{ text: "OK" }],
      );
    } else {
      // ENDing the current shift
      this.setState({ isActive: newStatus });
      await this.addLog(
        "Duty off",
        "power-outline",
        currentDayNumber,
        currentShiftId,
      );
      this.setState({ currentShiftId: "", currentShiftStart: null });

      // Stop the petrol reminder
      await this.stopPetrolReminder();
    }
  };

  getDistanceFromLatLonInKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    var R = 6371; // Radius of the earth in km
    var dLat = this.deg2rad(lat2 - lat1);
    var dLon = this.deg2rad(lon2 - lon1);
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
  };

  deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  addLog = async (
    activity: string,
    icon: string = "clipboard-outline",
    dayOverride?: number,
    shiftIdOverride?: string,
    shiftStartTime?: Date,
  ): Promise<void> => {
    try {
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const dayNumber =
        dayOverride !== undefined ? dayOverride : this.state.currentDayNumber;
      const shiftId = shiftIdOverride || this.state.currentShiftId;

      const user = auth.currentUser;
      if (!user) return;

      const logData: any = {
        uid: user.uid,
        activity: activity,
        time: time,
        icon: icon,
        dayNumber: dayNumber,
        shiftId: shiftId,
        createdAt: serverTimestamp(),
      };

      // If this is a shift start, also save the shift start time
      if (shiftStartTime) {
        logData.shiftStartTime = shiftStartTime;
      }

      await addDoc(collection(db, "logs"), logData);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Error adding log");
    }
  };

  handleSubmit = async (): Promise<void> => {
    if (!this.state.inputText.trim()) return;
    await this.addLog(this.state.inputText);
    this.setState({ inputText: "" });
  };

  render() {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        >
          {/* NAVBAR */}
          <View style={styles.navbar}>
            <View>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.title}>{this.state.guardName}</Text>
              <Text style={styles.subtitle}>{this.state.guardCode}</Text>
            </View>

            <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
              <TouchableOpacity
                onPress={this.toggleStatus}
                disabled={this.state.startingShift}
                activeOpacity={0.7}
                style={[
                  styles.statusButton,
                  this.state.isActive
                    ? styles.statusButtonEnd
                    : styles.statusButtonStart,
                  this.state.startingShift && { opacity: 0.7 },
                ]}
              >
                {this.state.startingShift ? (
                  <ActivityIndicator
                    size="small"
                    color="#2E7D32"
                    style={{ marginRight: 6 }}
                  />
                ) : (
                  <Ionicons
                    name={this.state.isActive ? "stop-circle" : "play-circle"}
                    size={20}
                    color={this.state.isActive ? "#D32F2F" : "#2E7D32"}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    { color: this.state.isActive ? "#D32F2F" : "#2E7D32" },
                  ]}
                >
                  {this.state.startingShift
                    ? "CHECKING..."
                    : this.state.isActive
                      ? "END"
                      : "START"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* HERO IMAGE */}
          <View style={styles.heroContainer}>
            <Image
              source={require("../../assets/images/hero.png")}
              style={styles.hero}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
            <Text style={styles.heroText}>Security Log</Text>
            {this.state.isActive && this.state.currentDayNumber > 0 && (
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>
                  Day {this.state.currentDayNumber}
                </Text>
              </View>
            )}
          </View>

          {this.state.isActive ? (
            <View>
              {/* INPUT SECTION */}
              <View style={styles.inputSection}>
                <Text style={styles.sectionTitle}>New Entry</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color="#999"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Log activity..."
                    placeholderTextColor="#A0AEC0"
                    style={styles.input}
                    value={this.state.inputText}
                    onChangeText={(text) => this.setState({ inputText: text })}
                  />
                </View>

                <TouchableOpacity
                  onPress={this.handleSubmit}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>Add Log</Text>
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color="white"
                    style={{ marginLeft: 5 }}
                  />
                </TouchableOpacity>
              </View>

              {/* TIMELINE SECTION */}
              <View style={styles.timelineSection}>
                <View style={styles.shiftHeader}>
                  <Text style={styles.sectionTitle}>Shift Occurrences</Text>
                  {this.state.currentShiftStart && (
                    <Text style={styles.shiftTimeText}>
                      Started:{" "}
                      {this.state.currentShiftStart.toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}{" "}
                      at{" "}
                      {this.state.currentShiftStart.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </Text>
                  )}
                </View>
                <View style={styles.timelineContainer}>
                  {this.state.loading ? (
                    <ActivityIndicator
                      size="large"
                      color="#3182CE"
                      style={{ marginTop: 20 }}
                    />
                  ) : (
                    this.state.logs
                      .filter(
                        (log) => log.shiftId === this.state.currentShiftId,
                      )
                      .map((item, index, filteredLogs) => (
                        <View
                          key={item.id || index}
                          style={styles.timelineItem}
                        >
                          {/* Time & Line */}
                          <View style={styles.timelineLeft}>
                            <Text style={styles.timelineTime}>{item.time}</Text>
                            <View style={styles.timelineLineContainer}>
                              <View style={styles.timelineDot} />
                              {index !== filteredLogs.length - 1 && (
                                <View style={styles.timelineLine} />
                              )}
                            </View>
                          </View>

                          {/* Content Card */}
                          <View style={styles.timelineContent}>
                            <View style={styles.timelineCard}>
                              <Ionicons
                                name={(item.icon || "ellipse-outline") as any}
                                size={18}
                                color="#4A5568"
                                style={{ marginRight: 8 }}
                              />
                              <Text style={styles.timelineText}>
                                {item.activity}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.offlineContainer}>
              <Ionicons name="moon-outline" size={48} color="#CBD5E0" />
              <Text style={styles.offlineText}>You are currently off duty</Text>
              <Text style={styles.offlineSubText}>
                Press START to begin your shift
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }
}

export default Index;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },

  // Navbar
  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 10,
  },
  greeting: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A202C",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#4A5568",
    marginTop: 2,
    fontWeight: "600",
    backgroundColor: "#E2E8F0",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },

  // Status Button
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusButtonStart: {
    backgroundColor: "white",
    borderColor: "#48BB78",
  },
  statusButtonEnd: {
    backgroundColor: "white",
    borderColor: "#F56565",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  // Hero
  heroContainer: {
    marginBottom: 30,
    borderRadius: 20,
    overflow: "hidden",
    height: 180,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  hero: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  heroText: {
    position: "absolute",
    bottom: 15,
    left: 15,
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 12,
  },

  // Input
  inputSection: {
    marginBottom: 30,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#2D3748",
  },
  submitButton: {
    backgroundColor: "#2D3748",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  // Timeline
  timelineSection: {
    flex: 1,
  },
  timelineContainer: {
    paddingLeft: 0,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 0,
    minHeight: 70,
  },
  timelineLeft: {
    width: 60,
    alignItems: "flex-end",
    marginRight: 10,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#718096",
    marginTop: 12,
  },
  timelineLineContainer: {
    position: "absolute",
    top: 18,
    right: -6.5, // Center on the dot
    alignItems: "center",
    height: "100%",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3182CE",
    borderWidth: 2,
    borderColor: "#BEE3F8",
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginTop: 0,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineCard: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    // Small shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timelineText: {
    fontSize: 15,
    color: "#2D3748",
    fontWeight: "500",
  },

  offlineContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  offlineText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4A5568",
    marginTop: 16,
  },
  offlineSubText: {
    fontSize: 14,
    color: "#A0AEC0",
    marginTop: 8,
  },

  dayBadge: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  dayBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Shift Header
  shiftHeader: {
    marginBottom: 12,
  },
  shiftTimeText: {
    fontSize: 13,
    color: "#718096",
    marginTop: 4,
    fontWeight: "500",
  },
});
