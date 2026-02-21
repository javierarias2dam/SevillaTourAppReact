import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { Screen } from "../components/Screen";
import { BottomBar } from "../components/BottomBar";
import { sendMessageToRasa, getRasaWebhook } from "../services/rasa";
import { colors, spacing, typography } from "../theme";

type ChatScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Chat">;
};

type MessageItem = {
  id: string;
  text: string;
  isUser: boolean;
};

export default function ChatScreen({ navigation }: ChatScreenProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText("");
    setError(null);

    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToEnd();

    setSending(true);
    try {
      const replies = await sendMessageToRasa(text);
      const botItems: MessageItem[] = replies.map((t, i) => ({
        id: `bot-${Date.now()}-${i}`,
        text: t,
        isUser: false,
      }));
      setMessages((prev) => [...prev, ...botItems]);
      scrollToEnd();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo conectar con el asistente.";
      setError(message);
      const errorMsg: MessageItem = {
        id: `err-${Date.now()}`,
        text: message,
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
      scrollToEnd();
    } finally {
      setSending(false);
    }
  }, [inputText, sending, scrollToEnd]);

  const handleRetry = useCallback(() => {
    setError(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MessageItem }) => (
      <View
        style={[styles.bubble, item.isUser ? styles.bubbleUser : styles.bubbleBot]}
      >
        <Text
          style={[
            styles.bubbleText,
            item.isUser ? styles.bubbleTextUser : styles.bubbleTextBot,
          ]}
        >
          {item.text}
        </Text>
      </View>
    ),
    []
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat con el asistente</Text>
          <Text style={styles.headerSubtitle}>
            Pregunta sobre tours y Sevilla.
          </Text>
        </View>

        {__DEV__ ? (
          <Text style={styles.debugUrl} numberOfLines={1}>
            Rasa URL: {getRasaWebhook() || "(no configurada)"}
          </Text>
        ) : null}

        {!getRasaWebhook().trim() ? (
          <View style={styles.warningBar}>
            <Text style={styles.warningText}>
              Copia .env.example a .env, rellena EXPO_PUBLIC_RASA_URL y reinicia
              con npx expo start -c
            </Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText} numberOfLines={2}>
              {error}
            </Text>
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>Escribiendo...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.muted}
            editable={!sending}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending || !inputText.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <BottomBar
        activeTab="chat"
        onNavigate={(route) => navigation.navigate(route)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.title,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: spacing.sm,
    borderRadius: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    ...typography.caption,
    color: colors.error,
  },
  retryButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  retryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  debugUrl: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontSize: 11,
  },
  warningBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    padding: spacing.sm,
    borderRadius: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: "85%",
    padding: spacing.md,
    borderRadius: spacing.lg,
    marginBottom: spacing.sm,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.body,
  },
  bubbleTextUser: {
    color: "#fff",
  },
  bubbleTextBot: {
    color: colors.text,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  typingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...typography.subtitle,
    color: "#fff",
  },
});
