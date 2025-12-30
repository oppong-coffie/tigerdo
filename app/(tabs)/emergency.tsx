import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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

interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
}

export default function Emergency() {
  const [modalVisible, setModalVisible] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSOS, setSendingSOS] = useState(false);
  const [currentCallIndex, setCurrentCallIndex] = useState(-1);

  // SMS API Configuration
  const SMS_API_KEY = "e215a200-0bd0-4afa-be6f-5a3cb4e35fd6";
  const SMS_SENDER_ID = "PrestigeLab";
  const EMERGENCY_MESSAGE =
    "EMERGENCY ALERT: Attack in progress at Lauren Apartment. Need help now. Please come immediately or alert others nearby.";

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");

  // Subscribe to emergency contacts collection
  useEffect(() => {
    const q = query(
      collection(db, "emergencyContacts"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedContacts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as EmergencyContact[];
      setContacts(fetchedContacts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Add contact to database
  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      alert("Please fill in name and phone number");
      return;
    }

    try {
      await addDoc(collection(db, "emergencyContacts"), {
        name: name,
        email: email,
        phone: phone,
        position: position,
        createdAt: serverTimestamp(),
      });

      // Clear form and close modal
      setName("");
      setEmail("");
      setPhone("");
      setPosition("");
      setModalVisible(false);
    } catch (error) {
      console.error("Error adding contact: ", error);
      alert("Error adding contact");
    }
  };

  // Delete contact from database
  const handleDeleteContact = (contact: EmergencyContact) => {
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to remove ${contact.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "emergencyContacts", contact.id));
              console.log("Contact deleted:", contact.name);
            } catch (error) {
              console.error("Error deleting contact:", error);
              alert("Error deleting contact");
            }
          },
        },
      ]
    );
  };

  // Send SOS SMS to all contacts
  const handleSendSOS = async () => {
    if (contacts.length === 0) {
      Alert.alert("No Contacts", "Please add emergency contacts first.");
      return;
    }

    Alert.alert(
      "Send SMS Alert",
      `This will send an emergency SMS to ${contacts.length} contact(s). Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send SMS",
          style: "destructive",
          onPress: async () => {
            setSendingSOS(true);
            let successCount = 0;
            let failCount = 0;

            for (const contact of contacts) {
              try {
                // Clean phone number (remove spaces, dashes, etc.)
                const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");

                const url = `https://sms.smsnotifygh.com/smsapi?key=${SMS_API_KEY}&to=${cleanPhone}&msg=${EMERGENCY_MESSAGE}&sender_id=${SMS_SENDER_ID}`;

                const response = await fetch(url);

                if (response.ok) {
                  console.log(`SMS sent to ${contact.name} (${cleanPhone})`);
                  successCount++;
                } else {
                  console.error(`Failed to send SMS to ${contact.name}`);
                  failCount++;
                }
              } catch (error) {
                console.error(`Error sending SMS to ${contact.name}:`, error);
                failCount++;
              }
            }

            setSendingSOS(false);

            Alert.alert(
              "SOS Complete",
              `Successfully sent: ${successCount}\nFailed: ${failCount}`,
              [{ text: "OK" }]
            );
          },
        },
      ]
    );
  };

  // Call emergency contacts one by one
  const handleCallContacts = () => {
    if (contacts.length === 0) {
      Alert.alert("No Contacts", "Please add emergency contacts first.");
      return;
    }

    const callNextContact = (index: number) => {
      if (index >= contacts.length) {
        Alert.alert(
          "Calls Complete",
          "All emergency contacts have been called."
        );
        setCurrentCallIndex(-1);
        return;
      }

      const contact = contacts[index];
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");

      Alert.alert(
        `Call ${contact.name}?`,
        `Position: ${contact.position || "N/A"}\nPhone: ${contact.phone}`,
        [
          {
            text: "Skip",
            style: "cancel",
            onPress: () => callNextContact(index + 1),
          },
          {
            text: "Call Now",
            onPress: async () => {
              try {
                await Linking.openURL(`tel:${cleanPhone}`);
                setCurrentCallIndex(index);
                // After call ends, prompt for next contact
                setTimeout(() => {
                  callNextContact(index + 1);
                }, 1000);
              } catch (error) {
                console.error("Error making call:", error);
                Alert.alert("Error", "Could not initiate call");
                callNextContact(index + 1);
              }
            },
          },
        ]
      );
    };

    Alert.alert(
      "Emergency Calls",
      `This will prompt you to call ${contacts.length} contact(s) one by one. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Calling",
          onPress: () => callNextContact(0),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Emergency Contacts</Text>
      <Text style={styles.subHeader}>
        Important contacts for emergency situations
      </Text>

      <ScrollView style={styles.contentWrapper}>
        {/* SOS BUTTON */}
        <TouchableOpacity
          style={[
            styles.sosButton,
            sendingSOS && styles.sosButtonDisabled,
            contacts.length === 0 && styles.sosButtonDisabled,
          ]}
          onPress={handleSendSOS}
          disabled={sendingSOS || contacts.length === 0}
        >
          {sendingSOS ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="warning" size={24} color="white" />
          )}
          <Text style={styles.sosButtonText}>
            {sendingSOS ? "Sending SOS..." : "🚨 SEND SMS TO ALL CONTACTS"}
          </Text>
        </TouchableOpacity>

        {/* CALL ALL BUTTON */}
        <TouchableOpacity
          style={[
            styles.callButton,
            contacts.length === 0 && styles.sosButtonDisabled,
          ]}
          onPress={handleCallContacts}
          disabled={contacts.length === 0}
        >
          <Ionicons name="call" size={24} color="white" />
          <Text style={styles.sosButtonText}>📞 CALL ALL CONTACTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Emergency Contact</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#E53E3E"
            style={{ marginTop: 50 }}
          />
        ) : contacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#E53E3E" />
            <Text style={styles.emptyText}>No emergency contacts yet</Text>
            <Text style={styles.emptySubText}>
              Add important contacts for emergency situations
            </Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.card}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteContact(contact)}
              >
                <Ionicons name="trash-outline" size={20} color="#E53E3E" />
              </TouchableOpacity>

              <Text style={styles.cardTitle}>{contact.name}</Text>
              {contact.position ? (
                <View style={styles.positionBadge}>
                  <Text style={styles.positionText}>{contact.position}</Text>
                </View>
              ) : null}

              <View style={styles.contactInfo}>
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={16} color="#4A5568" />
                  <Text style={styles.contactText}>{contact.phone}</Text>
                </View>
                {contact.email ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={16} color="#4A5568" />
                    <Text style={styles.contactText}>{contact.email}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ADD CONTACT FORM */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Emergency Contact</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Position (e.g. Doctor, Police)"
              value={position}
              onChangeText={setPosition}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddContact}
            >
              <Text style={styles.submitText}>Save Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
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
    backgroundColor: "#FFF5F5",
  },

  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#C53030",
    marginBottom: 4,
  },

  subHeader: {
    fontSize: 14,
    color: "#777",
    marginBottom: 20,
  },

  contentWrapper: {
    marginTop: 10,
  },

  sosButton: {
    backgroundColor: "#C53030",
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#9B2C2C",
    shadowColor: "#C53030",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  sosButtonDisabled: {
    backgroundColor: "#A0AEC0",
    borderColor: "#718096",
    shadowOpacity: 0,
  },

  sosButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
    letterSpacing: 0.5,
  },

  callButton: {
    backgroundColor: "#38A169",
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#276749",
    shadowColor: "#38A169",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  addButton: {
    backgroundColor: "#E53E3E",
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: "relative",
    borderLeftWidth: 4,
    borderLeftColor: "#E53E3E",
  },

  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 5,
    zIndex: 1,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A202C",
    marginBottom: 4,
    paddingRight: 30,
  },

  positionBadge: {
    backgroundColor: "#FED7D7",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },

  positionText: {
    fontSize: 12,
    color: "#C53030",
    fontWeight: "600",
  },

  contactInfo: {
    marginTop: 8,
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  contactText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#4A5568",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
  },

  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#C53030",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#F7FAFC",
  },

  submitBtn: {
    backgroundColor: "#E53E3E",
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },

  submitText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },

  closeButton: {
    marginTop: 12,
    padding: 12,
  },

  closeButtonText: {
    textAlign: "center",
    color: "#718096",
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },

  emptyText: {
    fontSize: 18,
    color: "#4A5568",
    textAlign: "center",
    marginTop: 12,
    fontWeight: "600",
  },

  emptySubText: {
    fontSize: 14,
    color: "#A0AEC0",
    textAlign: "center",
    marginTop: 4,
  },
});
