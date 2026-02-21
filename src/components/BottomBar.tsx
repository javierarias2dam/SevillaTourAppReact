import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme";

export type TabId = "tours" | "chat" | "profile";

type TabConfig = {
  id: TabId;
  label: string;
  iconActive: React.ComponentProps<typeof Ionicons>["name"];
  iconInactive: React.ComponentProps<typeof Ionicons>["name"];
  route: "Tours" | "Chat" | "Perfil";
};

const TABS: TabConfig[] = [
  {
    id: "tours",
    label: "Tours",
    iconActive: "compass",
    iconInactive: "compass-outline",
    route: "Tours",
  },
  {
    id: "chat",
    label: "Chat",
    iconActive: "chatbubble-ellipses",
    iconInactive: "chatbubble-ellipses-outline",
    route: "Chat",
  },
  {
    id: "profile",
    label: "Perfil",
    iconActive: "person",
    iconInactive: "person-outline",
    route: "Perfil",
  },
];

type BottomBarProps = {
  activeTab: TabId;
  onNavigate: (route: "Tours" | "Chat" | "Perfil") => void;
};

export function BottomBar({ activeTab, onNavigate }: BottomBarProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive ? tab.iconActive : tab.iconInactive;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onNavigate(tab.route)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  labelInactive: {
    color: colors.textSecondary,
  },
});
