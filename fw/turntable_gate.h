#pragma once
#include <stdint.h>

// Gate the analog turntable X axis by rotation angle.
// The HID X axis represents one full revolution as 256 counts, so the
// configured degree threshold is converted to X-axis counts internally.
class TurntableGate {
public:
  static uint8_t degrees_to_counts(uint8_t degrees) {
    if (degrees == 0) return 0;
    const uint16_t scaled = static_cast<uint16_t>(degrees) * 256U;
    return static_cast<uint8_t>((scaled + 359U) / 360U);
  }

  void reset(uint8_t raw, uint8_t position, uint32_t now) {
    previous = raw;
    output = position;
    last_motion = now;
    direction = 0;
    interval = 0;
    accumulated = 0;
    qualified = false;
  }

  uint8_t update(uint8_t raw, uint32_t now, uint8_t threshold_degrees) {
    int16_t delta = static_cast<int16_t>(raw) - previous;
    if (delta > 127) delta -= 256;
    if (delta < -128) delta += 256;
    previous = raw;
    if (delta == 0) return output;

    const int8_t next_direction = delta > 0 ? 1 : -1;
    const uint32_t gap = now - last_motion;
    uint32_t continuity = interval == 0 ? 250 : interval * 3;
    if (continuity < 30) continuity = 30;
    if (continuity > 1000) continuity = 1000;

    if (direction != next_direction || gap > continuity) {
      interval = 0;
      accumulated = 0;
      qualified = false;
    } else if (gap > 0) {
      interval = gap;
    }

    direction = next_direction;
    last_motion = now;

    if (threshold_degrees == 0) {
      output = static_cast<uint8_t>(output + delta);
      return output;
    }

    if (qualified) {
      output = static_cast<uint8_t>(output + delta);
      return output;
    }

    const uint16_t magnitude = static_cast<uint16_t>(delta < 0 ? -delta : delta);
    accumulated += magnitude;
    if (accumulated >= degrees_to_counts(threshold_degrees)) {
      qualified = true;
      // The movement that reaches the configured angle is the first accepted
      // X-axis movement; earlier movement in the gesture remains discarded.
      output = static_cast<uint8_t>(output + delta);
    }

    return output;
  }

private:
  uint8_t previous = 0, output = 0;
  int8_t direction = 0;
  uint32_t last_motion = 0;
  uint32_t interval = 0;
  uint16_t accumulated = 0;
  bool qualified = false;
};
