import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

interface Person {
  id: string;
  name: string;
  description: string;
  number: string;
}

interface Car {
  id: string;
  name: string;
  description: string;
  number: string;
}

export default function Authorize() {
  const [activeTab, setActiveTab] = useState("people");
  const [peopleModalVisible, setPeopleModalVisible] = useState(false);
  const [carsModalVisible, setCarsModalVisible] = useState(false);

  // Database state
  const [people, setPeople] = useState<Person[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for adding people
  const [personName, setPersonName] = useState("");
  const [personDescription, setPersonDescription] = useState("");
  const [personNumber, setPersonNumber] = useState("");

  // Form state for adding cars
  const [carName, setCarName] = useState("");
  const [carDescription, setCarDescription] = useState("");
  const [carNumber, setCarNumber] = useState("");

  // Subscribe to people collection
  useEffect(() => {
    const q = query(
      collection(db, "authorizedPeople"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPeople = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Person[];
      setPeople(fetchedPeople);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to cars collection
  useEffect(() => {
    const q = query(
      collection(db, "authorizedCars"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCars = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Car[];
      setCars(fetchedCars);
    });

    return () => unsubscribe();
  }, []);

  // Add person to database
  const handleAddPerson = async () => {
    if (!personName.trim() || !personNumber.trim()) {
      alert("Please fill in name and phone number");
      return;
    }

    try {
      await addDoc(collection(db, "authorizedPeople"), {
        name: personName,
        description: personDescription,
        number: personNumber,
        createdAt: serverTimestamp(),
      });

      // Clear form and close modal
      setPersonName("");
      setPersonDescription("");
      setPersonNumber("");
      setPeopleModalVisible(false);
    } catch (error) {
      console.error("Error adding person: ", error);
      alert("Error adding person");
    }
  };

  // Add car to database
  const handleAddCar = async () => {
    if (!carName.trim() || !carNumber.trim()) {
      alert("Please fill in car name and number");
      return;
    }

    try {
      await addDoc(collection(db, "authorizedCars"), {
        name: carName,
        description: carDescription,
        number: carNumber,
        createdAt: serverTimestamp(),
      });

      // Clear form and close modal
      setCarName("");
      setCarDescription("");
      setCarNumber("");
      setCarsModalVisible(false);
    } catch (error) {
      console.error("Error adding car: ", error);
      alert("Error adding car");
    }
  };

  // Delete person from database
  const handleDeletePerson = (person: Person) => {
    Alert.alert(
      "Delete Person",
      `Are you sure you want to remove ${person.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "authorizedPeople", person.id));
              console.log("Person deleted:", person.name);
            } catch (error) {
              console.error("Error deleting person:", error);
              alert("Error deleting person");
            }
          },
        },
      ]
    );
  };

  // Delete car from database
  const handleDeleteCar = (car: Car) => {
    Alert.alert(
      "Delete Car",
      `Are you sure you want to remove ${car.name} (${car.number})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "authorizedCars", car.id));
              console.log("Car deleted:", car.name);
            } catch (error) {
              console.error("Error deleting car:", error);
              alert("Error deleting car");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Authorize People or Cars</Text>
      <Text style={styles.subHeader}>
        Only these people or cars can enter the premises.
      </Text>

      {/* TAB MENU */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "people" && styles.activeTab]}
          onPress={() => setActiveTab("people")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "people" && styles.activeTabText,
            ]}
          >
            People
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "cars" && styles.activeTab]}
          onPress={() => setActiveTab("cars")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "cars" && styles.activeTabText,
            ]}
          >
            Cars
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <ScrollView style={styles.contentWrapper}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            activeTab === "people"
              ? setPeopleModalVisible(true)
              : setCarsModalVisible(true)
          }
        >
          <Text style={styles.addButtonText}>+ Add {activeTab}</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#3182CE"
            style={{ marginTop: 50 }}
          />
        ) : (activeTab === "people" ? people : cars).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No {activeTab} authorized yet</Text>
          </View>
        ) : (
          (activeTab === "people" ? people : cars).map((item) => (
            <View key={item.id} style={styles.card}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  activeTab === "people"
                    ? handleDeletePerson(item as Person)
                    : handleDeleteCar(item as Car)
                }
              >
                <Ionicons name="trash-outline" size={20} color="#E53E3E" />
              </TouchableOpacity>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
              <Text style={styles.cardNumber}>
                {activeTab === "people" ? "📞" : "🚗"} {item.number}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* PEOPLE FORM */}
      <Modal
        visible={peopleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPeopleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Person</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={personName}
              onChangeText={setPersonName}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (e.g. Brother, Friend)"
              value={personDescription}
              onChangeText={setPersonDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={personNumber}
              onChangeText={setPersonNumber}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddPerson}
            >
              <Text style={styles.submitText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setPeopleModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CARS FORM */}
      <Modal
        visible={carsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCarsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Car</Text>

            <TextInput
              style={styles.input}
              placeholder="Car Name"
              value={carName}
              onChangeText={setCarName}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (e.g. White Toyota)"
              value={carDescription}
              onChangeText={setCarDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Car Number (e.g. GT-1234-21)"
              value={carNumber}
              onChangeText={setCarNumber}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddCar}>
              <Text style={styles.submitText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCarsModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================================
          STYLES
================================ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F7F7F7",
  },

  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },

  subHeader: {
    fontSize: 14,
    color: "#777",
    marginBottom: 20,
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#eaeaea",
    borderRadius: 10,
    overflow: "hidden",
  },

  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },

  activeTab: {
    backgroundColor: "black",
  },

  tabText: {
    fontSize: 16,
    color: "gray",
  },

  activeTabText: {
    color: "white",
    fontWeight: "bold",
  },

  contentWrapper: {
    marginTop: 20,
  },

  addButton: {
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },

  addButtonText: {
    textAlign: "center",
    color: "white",
    fontSize: 16,
  },

  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    position: "relative",
  },

  deleteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 1,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  cardDescription: {
    color: "#555",
    marginTop: 4,
  },

  cardNumber: {
    marginTop: 6,
    color: "#333",
    fontWeight: "bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
  },

  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },

  submitBtn: {
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },

  submitText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },

  closeButton: {
    marginTop: 12,
    padding: 12,
  },

  closeButtonText: {
    textAlign: "center",
    color: "red",
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },

  emptyText: {
    fontSize: 16,
    color: "#A0AEC0",
    textAlign: "center",
  },
});
