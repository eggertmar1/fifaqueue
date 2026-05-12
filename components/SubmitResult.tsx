import { View, Text, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import GlassSurface from "./GlassSurface";

interface SubmitResultProps {
  onSubmit: (team1Goals: number, team2Goals: number) => void;
  submitting?: boolean;
}

function GoalPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.goalPickerContainer}>
      <Text style={styles.goalPickerLabel}>
        {label}
      </Text>
      <View style={styles.goalPickerRow}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          style={styles.goalButton}
        >
          <Text style={styles.goalButtonText}>-</Text>
        </Pressable>
        <Text style={styles.goalValue}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(99, value + 1))}
          style={styles.goalButton}
        >
          <Text style={styles.goalButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SubmitResult({ onSubmit, submitting }: SubmitResultProps) {
  const [team1Goals, setTeam1Goals] = useState(0);
  const [team2Goals, setTeam2Goals] = useState(0);

  const isDisabled = !!submitting;

  return (
    <GlassSurface style={styles.card} fallbackStyle={styles.cardFallback}>
      <Text style={styles.title}>
        Submit Score
      </Text>
      <View style={styles.scoreRow}>
        <GoalPicker label="TEAM 1" value={team1Goals} onChange={setTeam1Goals} />
        <Text style={styles.scoreSeparator}>-</Text>
        <GoalPicker label="TEAM 2" value={team2Goals} onChange={setTeam2Goals} />
      </View>
      <Pressable
        onPress={() => onSubmit(team1Goals, team2Goals)}
        disabled={isDisabled}
        style={[
          styles.submitButton,
          isDisabled ? styles.submitButtonDisabled : styles.submitButtonActive,
        ]}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? "Submitting..." : "Submit Score"}
        </Text>
      </Pressable>
      {team1Goals === team2Goals && team1Goals > 0 && (
        <Text style={styles.drawWarning}>
          Draw — no ELO changes
        </Text>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  goalPickerContainer: {
    flex: 1,
    alignItems: "center",
  },
  goalPickerLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 1,
  },
  goalPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  goalButtonText: {
    color: "#E8E8E8",
    fontSize: 20,
    fontWeight: "700",
  },
  goalValue: {
    color: "#E8E8E8",
    fontSize: 36,
    fontWeight: "700",
    width: 48,
    textAlign: "center",
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  cardFallback: {
    backgroundColor: "rgba(42, 46, 52, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  title: {
    color: "#E8E8E8",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scoreSeparator: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 20,
    marginHorizontal: 8,
  },
  submitButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonActive: {
    backgroundColor: "rgba(127, 217, 168, 0.85)",
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  submitButtonText: {
    color: "#171B22",
    fontWeight: "700",
    fontSize: 16,
  },
  drawWarning: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
