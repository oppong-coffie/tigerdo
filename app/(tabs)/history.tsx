import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

interface Log {
  id: string;
  activity: string;
  time: string;
  icon?: string;
  dayNumber?: number;
  shiftId?: string;
  createdAt?: any;
}

interface Section {
  title: string;
  data: Log[];
}

export default function History() {
  const [allLogs, setAllLogs] = useState<Log[]>([]); // Store raw logs
  const [sections, setSections] = useState<Section[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtering
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "logs"),
      where("uid", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Log[];

      // Sort logs by createdAt descending in memory
      fetchedLogs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });

      setAllLogs(fetchedLogs);
      updateSections(fetchedLogs, selectedDate);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Run on mount

  // Re-run grouping when logs or selectedDate changes
  useEffect(() => {
    updateSections(allLogs, selectedDate);
  }, [selectedDate, allLogs]);

  const updateSections = (logs: Log[], dateFilter: Date | null) => {
    let filteredLogs = logs;

    if (dateFilter) {
      filteredLogs = logs.filter((log) => {
        if (!log.createdAt || !log.createdAt.toDate) return false;
        const logDate = log.createdAt.toDate();
        return (
          logDate.getDate() === dateFilter.getDate() &&
          logDate.getMonth() === dateFilter.getMonth() &&
          logDate.getFullYear() === dateFilter.getFullYear()
        );
      });
    }

    setTotalCount(filteredLogs.length);

    // Group by Shift ID instead of Day Number
    const groups = new Map<string, { logs: Log[]; startTime: Date | null }>();

    filteredLogs.forEach((log) => {
      const shiftId = log.shiftId || "unassigned";
      if (!groups.has(shiftId)) {
        groups.set(shiftId, { logs: [], startTime: null });
      }
      const group = groups.get(shiftId)!;
      group.logs.push(log);

      // If this is a "Duty on" log, capture the start time
      if (log.activity === "Duty on" && log.createdAt?.toDate) {
        group.startTime = log.createdAt.toDate();
      }
    });

    // Sort shifts by most recent first (using the first log's createdAt in each group)
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => {
      const aTime = a[1].logs[0]?.createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b[1].logs[0]?.createdAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });

    const newSections: Section[] = sortedEntries.map(([shiftId, group]) => {
      // Format the section title based on shift start time
      let title = "Previous Activity";
      if (shiftId !== "unassigned" && group.startTime) {
        const startDate = group.startTime;
        const dateStr = startDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = startDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        title = `Shift - ${dateStr}, ${timeStr}`;
      } else if (shiftId !== "unassigned") {
        // Shift has ID but no start time found
        title = `Shift ${shiftId.replace("shift_", "").substring(0, 8)}...`;
      }

      return {
        title,
        data: group.logs,
      };
    });

    setSections(newSections);
  };

  const handleDateChange = (event: any, date?: Date) => {
    // On Android, the picker closes automatically.
    // On iOS, we might want to keep it open or handle 'done'.
    setShowDatePicker(false);

    if (event.type === "set" || date) {
      if (date) setSelectedDate(date);
    }
  };

  const clearFilter = () => {
    setSelectedDate(null);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
    return "Recent";
  };

  const renderItem = ({ item }: { item: Log }) => (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={(item.icon || "receipt-outline") as any}
          size={20}
          color="#3182CE"
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.activityText}>{item.activity}</Text>
        <Text style={styles.dateText}>
          {formatDate(item.createdAt)} • {item.time}
        </Text>
      </View>
    </View>
  );

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: { title: string };
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subTitle}>
              {selectedDate ? selectedDate.toLocaleDateString() : "All logs"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {selectedDate && (
              <TouchableOpacity onPress={clearFilter} style={styles.iconButton}>
                <Ionicons name="close-circle" size={24} color="#E53E3E" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                console.log("Date picker button pressed");
                setShowDatePicker(true);
              }}
              style={[styles.iconButton, { marginLeft: 10 }]}
            >
              <Ionicons name="calendar-outline" size={24} color="#3182CE" />
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#3182CE"
            style={{ marginTop: 50 }}
          />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color="#CBD5E0"
                />
                <Text style={styles.emptyText}>No history available yet</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A202C",
  },
  subTitle: {
    fontSize: 14,
    color: "#718096",
    marginTop: 2,
    fontWeight: "500",
  },
  iconButton: {
    padding: 8,
    backgroundColor: "#EBF8FF",
    borderRadius: 20,
  },
  badge: {
    backgroundColor: "#EBF8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#3182CE",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBF8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: "#A0AEC0",
  },
});
