#include "../turntable_gate.h"
#include <assert.h>
#include <stdio.h>

static uint8_t threshold_counts(uint8_t degrees) {
  return degrees == 0 ? 0 : static_cast<uint8_t>((static_cast<uint16_t>(degrees) * 256U + 359U) / 360U);
}

int main() {
  assert(TurntableGate::degrees_to_counts(0) == 0);
  assert(TurntableGate::degrees_to_counts(1) == 1);
  assert(TurntableGate::degrees_to_counts(5) == 4);
  assert(TurntableGate::degrees_to_counts(30) == 22);

  // 0 degrees passes input immediately. For non-zero settings, movements
  // before the configured angle are discarded and the movement that reaches
  // the angle is the first accepted movement.
  for (int degrees = 0; degrees <= 30; ++degrees) {
    for (int sign = -1; sign <= 1; sign += 2) {
      TurntableGate gate;
      gate.reset(0, 0, 0);
      const int threshold = threshold_counts(static_cast<uint8_t>(degrees));
      for (int count = 1; count <= threshold + 4; ++count) {
        const auto value = gate.update(static_cast<uint8_t>(count * sign), count,
                                       static_cast<uint8_t>(degrees));
        const int accepted = degrees == 0 ? count
          : (count >= threshold ? count - threshold + 1 : 0);
        assert(value == static_cast<uint8_t>(accepted * sign));
      }
    }
  }

  // Stopping starts a fresh gesture; waiting alone never qualifies.
  TurntableGate gate;
  gate.reset(0, 0, 0);
  assert(gate.update(1, 1, 5) == 0);
  assert(gate.update(2, 2, 5) == 0);
  assert(gate.update(3, 3, 5) == 0);
  assert(gate.update(3, 2000, 5) == 0);
  assert(gate.update(4, 2001, 5) == 0);
  assert(gate.update(5, 2002, 5) == 0);
  assert(gate.update(6, 2003, 5) == 0);
  assert(gate.update(7, 2004, 5) == 1);

  // Reversing direction also starts a fresh gesture.
  gate.reset(0, 0, 0);
  assert(gate.update(1, 1, 5) == 0);
  assert(gate.update(2, 2, 5) == 0);
  assert(gate.update(3, 3, 5) == 0);
  assert(gate.update(2, 4, 5) == 0);
  assert(gate.update(1, 5, 5) == 0);
  assert(gate.update(0, 6, 5) == 0);
  assert(gate.update(255, 7, 5) == 255);

  // Wraparound of both X-axis values and the millisecond timer remains safe.
  gate.reset(254, 100, 0xfffffff0UL);
  assert(gate.update(255, 0xfffffff1UL, 5) == 100);
  assert(gate.update(0,   0xfffffff2UL, 5) == 100);
  assert(gate.update(1,   0xfffffff3UL, 5) == 100);
  assert(gate.update(2,   0xfffffff4UL, 5) == 101);

  puts("PASS: angle deadzone 0..30 degrees, both directions, stop/restart, reversal and wraparound");
}
